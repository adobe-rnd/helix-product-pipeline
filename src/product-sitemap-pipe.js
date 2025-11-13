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
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { validatePathInfo } from './utils/path.js';
import initConfig from './steps/init-config.js';
import fetchProductBusContent from './steps/fetch-productbus.js';
import { setLastModified } from './utils/last-modified.js';
import { set404CacheHeaders } from './steps/set-cache-headers.js';

dayjs.extend(utc);

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
 * @param {PipelineState} state
 * @param {SharedTypes.StoredMerchantFeed[string]['data']} data
 * @returns {string}
 */
const sitemapEntry = (state, data) => {
  const {
    lastmod: lastmodConfig,
    extension = '',
  } = state.config?.productSitemapConfig ?? {};
  let lastmod;
  if (lastmodConfig && data.lastModified !== undefined) {
    const date = dayjs.utc(new Date(data.lastModified));
    if (date.isValid()) {
      lastmod = date.format(lastmodConfig);
    }
  }
  return `
  <url>
    <loc>${data.url}${extension}</loc>\
${optionalEntry('lastmod', lastmod)}
  </url>`;
};

/**
 * @param {PipelineState} state
 * @param {SharedTypes.StoredIndex} index
 * @returns {string}
 */
export function toSitemapXML(state, index) {
  return `\
<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\
${Object.entries(index)
    .filter(([_, entry]) => !entry.filters?.noindex)
    .map(([_, entry]) => sitemapEntry(state, entry.data)).join('')}
</urlset>`;
}

/**
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {Promise<PipelineResponse>}
 */
export async function productSitemapPipe(state, req) {
  const { log, info } = state;
  const { extension } = info;
  state.type = 'sitemap';

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

    res.body = toSitemapXML(state, state.content.data);
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
