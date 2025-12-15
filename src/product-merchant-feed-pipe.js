/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { PipelineResponse, PipelineStatusError } from '@adobe/helix-html-pipeline';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { validatePathInfo } from './utils/path.js';
import initConfig from './steps/init-config.js';
import fetchProductBusContent from './steps/fetch-productbus.js';
import { setLastModified } from './utils/last-modified.js';
import { set404CacheHeaders } from './steps/set-cache-headers.js';
import { getIncludes } from './steps/utils.js';

/**
 * @param {string} key
 * @param {string} [value]
 * @returns {string}
 */
const optionalEntry = (key, value) => {
  if (value) {
    return `
    <${key}>${value}</${key}>`;
  }
  return '';
};

/**
 * Turns relative link into absolute,
 * including the current path prefix (up to "/merchant-center-feed.xml")
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {string} relLink ex. "./media_b526c80c86439f4afb9308d8963f073b872edef7.jpg"
 * @returns {string}
 */
const relToAbsLink = (state, req, relLink) => {
  if (!relLink) {
    return '';
  }
  const { prodHost } = state;
  const path = req.url.pathname.replace(/\/merchant-center-feed\.xml$/, '');
  const url = new URL(
    path + (relLink.startsWith('.') ? relLink.substring(1) : relLink),
    /^https?:\/\//.test(prodHost) ? prodHost : `https://${prodHost}`,
  );
  return url.toString();
};

/**
 * @param {{ shipping?: string | object | object[] }} data
 * @returns {string}
 */
const shipping = (data) => {
  if (data.shipping && typeof data.shipping === 'object') {
    return (
      Array.isArray(data.shipping)
        ? data.shipping
        : [data.shipping]
    ).map((s) => `
    <g:shipping>\
      ${optionalEntry('g:country', s.country)}\
      ${optionalEntry('g:region', s.region)}\
      ${optionalEntry('g:service', s.service)}\
      ${optionalEntry('g:price', s.price)}\
      ${optionalEntry('g:min_handling_time', s.min_handling_time)}\
      ${optionalEntry('g:max_handling_time', s.max_handling_time)}\
      ${optionalEntry('g:min_transit_time', s.min_transit_time)}\
      ${optionalEntry('g:max_transit_time', s.max_transit_time)}
    </g:shipping>`).join('\n');
  }
  if (data.shipping && typeof data.shipping === 'string') {
    return data.shipping;
  }
  return '';
};

/**
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {SharedTypes.StoredMerchantFeed[string]['data']} data
 * @returns {string}
 */
const feedEntry = (state, req, data) => `
  <item>
    <g:id>${data.id}</g:id>
    <g:title>${data.title ?? ''}</g:title>
    <g:description>
    ${data.description ?? ''}
    </g:description>
    <g:link>${data.link ?? ''}</g:link>
    <g:image_link>${relToAbsLink(state, req, data.image_link)}</g:image_link>
    <g:condition>${data.condition ?? ''}</g:condition>
    <g:availability>${data.availability ?? ''}</g:availability>
    <g:price>${data.price ?? ''}</g:price>
    <g:brand>${data.brand ?? ''}</g:brand>\
${optionalEntry('g:age_group', data.age_group)}\
${optionalEntry('g:google_product_category', data.google_product_category)}\
${optionalEntry('g:product_type', data.product_type)}\
${optionalEntry('g:color', data.color)}\
${optionalEntry('g:size', data.size)}\
${optionalEntry('g:gender', data.gender)}\
${optionalEntry('g:material', data.material)}\
${optionalEntry('g:pattern', data.pattern)}\
${optionalEntry('g:gtin', data.gtin)}\
${optionalEntry('g:mpn', data.mpn)}\
${optionalEntry('g:identifier_exists', data.identifier_exists)}\
${optionalEntry('g:item_group_id', data.item_group_id)}\
${optionalEntry('g:is_bundle', data.is_bundle)}\
${shipping(data)}
  </item>\
  ${data.variants
    ? Object.entries(data.variants).map(([_, variant]) => feedEntry(state, req, variant)).join('')
    : ''}`;

/**
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {SharedTypes.StoredMerchantFeed} merchantFeed
 * @returns {string}
 */
export function toFeedXML(state, req, merchantFeed) {
  const { title, description, link } = state.config?.merchantFeedConfig ?? {};
  const includes = getIncludes(req);
  return `\
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${title ?? ''}</title>
  <link>${link ?? ''}</link>
  <description>
  ${description ?? ''}
  </description>\
${Object.entries(merchantFeed)
    .filter(([_, entry]) => includes.all || !entry.filters?.noindex || includes.noindex)
    .map(([_, entry]) => feedEntry(state, req, entry.data)).join('')}
</channel>
</rss>`;
}

/**
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {Promise<PipelineResponse>}
 */
export async function productMerchantFeedPipe(state, req) {
  // TEMPORARILY DISABLED: Pending re-implementation from @maxed
  return new PipelineResponse('', {
    status: 501,
    headers: {
      'x-error': 'Product merchant feed temporarily disabled during migration',
    },
  });

  /* eslint-disable no-unreachable */
  const { log, info } = state;
  const { extension } = info;
  state.type = 'merchant-feed';

  if (!validatePathInfo(state.info)) {
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': 'invalid path',
      },
    });
  }

  if (extension !== '.xml') {
    log.error('only xml resources supported.');
    return new PipelineResponse('', {
      status: 400,
      headers: {
        'x-error': 'only xml resources supported.',
      },
    });
  }

  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'application/xml',
    },
  });

  try {
    await initConfig(state, req, res);

    state.timer?.update('content-fetch');
    await fetchProductBusContent(state, req, res);
    if (res.error) {
      if (res.status < 400) {
        return res;
      }
      throw new PipelineStatusError(res.status, res.error);
    }

    // TODO: set surrogate keys
    // const keys = await computeJSONSurrogateKeys(state);
    // setCachingHeaders(state, req, res, keys);

    setLastModified(state, res);

    res.body = toFeedXML(state, req, state.content.data);
  } catch (e) {
    const errorRes = new PipelineResponse('', {
      /* c8 ignore next 6 */
      status: e instanceof PipelineStatusError ? e.code : 500,
      headers: {
        'x-error': cleanupHeaderValue(e.message),
      },
    });
    const level = errorRes.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${errorRes.status} ${e.message}`, e);
    errorRes.body = '';
    if (errorRes.status === 404) {
      await set404CacheHeaders(state, req, errorRes);
    }
    return errorRes;
  }

  return res;
}
