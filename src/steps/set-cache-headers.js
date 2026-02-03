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

/* eslint-disable camelcase */

import {
  computeProductPathKey,
  computeSiteKey,
  compute404Key,
  computeAuthoredContentKey,
  computeProductKeys,
} from '@dylandepass/helix-product-shared';
import { applyByoCdnHeaders } from '../utils/cache-headers.js';

/**
 * Sets the cache headers for a product
 * @param {PipelineRequest} req
 * @param {PipelineResponse} resp
 * @param {string[]} cacheKeys
 * @returns {void}
 */
export function setCachingHeaders(req, resp, cacheKeys) {
  // cache instructions for BYO CDN and the browser
  const pushInvalidation = req.headers.get('x-push-invalidation') === 'enabled';

  // browser ttl & browser cache-control
  let browserTTL;
  if ([302, 400, 401].includes(resp.status)) {
    browserTTL = 0;
    resp.headers.set('cache-control', 'private; no-cache');
  } else {
    browserTTL = 7200;
    resp.headers.set('cache-control', `max-age=${browserTTL}, must-revalidate`);
  }

  // CDN ttl
  let cdnTTL;
  if ([400, 401].includes(resp.status)) {
    // don't cache 400 & 401 responses in order to avoid potential downstream caching issues
    cdnTTL = 0;
  } else {
    cdnTTL = pushInvalidation ? 172800 : 300;
  }

  applyByoCdnHeaders(resp, req, cacheKeys, browserTTL, cdnTTL);
}

/**
 * Sets the cache headers for a product 404 page
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} resp
 * @returns {Promise<void>}
 */
export async function setProduct404CacheHeaders(state, req, resp) {
  const {
    org, site, contentBusId, info,
  } = state;

  const authoredContentKey = await computeAuthoredContentKey(contentBusId, info.originalPath);
  const keys = [
    await computeProductPathKey(org, site, info.path),
    await computeSiteKey(org, site),
    await compute404Key(org, site),
    authoredContentKey,
  ];

  setCachingHeaders(req, resp, keys);
}

/**
 * Sets the cache headers for a 404 page
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} resp
 * @returns {Promise<void>}
 */
export async function set404CacheHeaders(state, req, resp) {
  const { org, site } = state;

  const keys = [compute404Key(org, site)];
  setCachingHeaders(req, resp, keys);
}

/**
 * Sets the cache headers for a product
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} resp
 * @returns {Promise<void>}
 */
export async function setProductCacheHeaders(state, req, resp) {
  const {
    org, site, contentBusId, info,
  } = state;

  const productKeys = await computeProductKeys(org, site, info.path, contentBusId);
  setCachingHeaders(req, resp, productKeys);
}
