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
import fetchContent from './steps/fetch-content.js';
import { setLastModified } from './utils/last-modified.js';
import { compute404Keys } from './steps/set-cache-headers.js';
import { stripHTML } from './steps/utils.js';

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
 * @param {{ shipping?: string | object | object[] }} entry
 * @returns {string}
 */
const shipping = (entry) => {
  if (entry.shipping && typeof entry.shipping === 'object') {
    return (
      Array.isArray(entry.shipping)
        ? entry.shipping
        : [entry.shipping]
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
  if (entry.shipping && typeof entry.shipping === 'string') {
    return entry.shipping;
  }
  return '';
};

/**
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {StoredMerchantFeed[string]} entry
 * @returns {string}
 */
const feedEntry = (state, req, entry) => `
  <item>
    <g:id>${entry.id}</g:id>
    <g:title>${entry.title ?? ''}</g:title>
    <g:description>
    ${stripHTML(entry.description ?? '')}
    </g:description>
    <g:link>${entry.link ?? ''}</g:link>
    <g:image_link>${relToAbsLink(state, req, entry.image_link)}</g:image_link>
    <g:condition>${entry.condition ?? ''}</g:condition>
    <g:availability>${entry.availability ?? ''}</g:availability>
    <g:price>${entry.price ?? ''}</g:price>
    <g:brand>${entry.brand ?? ''}</g:brand>\
${optionalEntry('g:age_group', entry.age_group)}\
${optionalEntry('g:google_product_category', entry.google_product_category)}\
${optionalEntry('g:product_type', entry.product_type)}\
${optionalEntry('g:color', entry.color)}\
${optionalEntry('g:size', entry.size)}\
${optionalEntry('g:gender', entry.gender)}\
${optionalEntry('g:material', entry.material)}\
${optionalEntry('g:pattern', entry.pattern)}\
${optionalEntry('g:gtin', entry.gtin)}\
${optionalEntry('g:mpn', entry.mpn)}\
${optionalEntry('g:identifier_exists', entry.identifier_exists)}\
${optionalEntry('g:item_group_id', entry.item_group_id)}\
${optionalEntry('g:is_bundle', entry.is_bundle)}\
${shipping(entry)}
  </item>\
  ${entry.variants ? Object.entries(entry.variants).map(([_, variant]) => feedEntry(state, req, variant)).join('') : ''}`;

/**
 * @param {State} state
 * @param {PipelineRequest} req
 * @param {StoredMerchantFeed} merchantFeed
 * @returns {string}
 */
export function toFeedXML(state, req, merchantFeed) {
  const { title, description, link } = state.config?.merchantFeedConfig ?? {};
  return `\
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${title ?? ''}</title>
  <link>${link ?? ''}</link>
  <description>
  ${description ?? ''}
  </description>\
${Object.entries(merchantFeed).map(([_, entry]) => feedEntry(state, req, entry)).join('')}
</channel>
</rss>`;
}

export async function productMerchantFeedPipe(state, req) {
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
    await fetchContent(state, req, res);
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
      /* c8 ignore next 3 */
      status: e instanceof PipelineStatusError ? e.code : 500,
    });
    const level = errorRes.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${errorRes.status} ${e.message}`, e);
    errorRes.body = '';
    errorRes.headers.set('x-error', cleanupHeaderValue(e.message));
    if (errorRes.status === 404) {
      const keys = await compute404Keys(state);
      errorRes.headers.set('x-surrogate-key', keys.join(' '));
    }
    return errorRes;
  }

  return res;
}
