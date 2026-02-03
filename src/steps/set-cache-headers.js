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
  computeMediaKeys,
  computeAuthoredContentKey,
  computeProductKeys,
} from '@dylandepass/helix-product-shared';

export const isMediaRequest = (url) => /\/media_[0-9a-f]{40,}[/a-zA-Z0-9_-]*\.[0-9a-z]+$/.test(url.pathname);
const BYO_CDN_TYPES = ['akamai', 'cloudflare', 'fastly', 'cloudfront'];

/**
 * Sets the cache headers for a product
 * @param {PipelineRequest} req
 * @param {PipelineResponse} resp
 * @param {string[]} cacheKeys
 * @returns {void}
 */
export function setCachingHeaders(req, resp, cacheKeys) {
  const url = new URL(req.url);

  // determine BYO CDN type
  let byo_cdn_type = req.headers.get('x-byo-cdn-type');
  const via = req.headers.get('via') || '';
  const cdn_loop = req.headers.get('cdn-loop') || '';
  // FIXME: cloudflare seems to strip the CDN-Loop header, i.e. the worker can't see it...
  if (!BYO_CDN_TYPES.includes(byo_cdn_type)) {
    // sniff downstream cdn type
    if (/[Aa]kamai/.test(via)) {
      byo_cdn_type = 'akamai';
    } else if (via.includes('varnish') || cdn_loop.startsWith('Fastly')) {
      byo_cdn_type = 'fastly';
    } else if (cdn_loop.includes('cloudflare') || req.headers.has('cf-worker')) {
      byo_cdn_type = 'cloudflare';
    } else if (via.includes('CloudFront')) {
      byo_cdn_type = 'cloudfront';
    } else {
      // invalid/unsupported CDN type
      byo_cdn_type = undefined;
    }
  }

  // cache instructions for BYO CDN and the browser
  const pushInvalidation = req.headers.get('x-push-invalidation') === 'enabled';
  // browser ttl & browser cache-control
  let browserTTL;
  if ([302, 400, 401].includes(resp.status)) {
    browserTTL = 0;
    resp.headers.set('cache-control', 'private; no-cache');
  } else {
    if (isMediaRequest(url)) {
      browserTTL = resp.status === 200 ? 2592000 : 3600;
    } else {
      browserTTL = 7200;
    }
    resp.headers.set('cache-control', `max-age=${browserTTL}, must-revalidate`);
  }

  // CDN ttl
  let cdnTTL;
  if ([400, 401].includes(resp.status)) {
    // don't cache 400 & 401 repsonses in order to avoid potential downstream caching issues
    cdnTTL = 0;
  } else if (isMediaRequest(url)) {
    cdnTTL = resp.status === 200 ? 2592000 : 3600;
  } else {
    cdnTTL = pushInvalidation ? 172800 : 300;
  }
  switch (byo_cdn_type) {
    case 'cloudflare':
      resp.headers.set('cdn-cache-control', `max-age=${cdnTTL}, must-revalidate`);
      break;
    case 'fastly':
      resp.headers.set('surrogate-control', `max-age=${cdnTTL}, stale-while-revalidate=0`);
      break;
    case 'akamai':
      resp.headers.set('edge-control', `!no-store,max-age=${cdnTTL}s,downstream-ttl=${browserTTL}s`);
      break;
    case 'cloudfront':
      resp.headers.set('cache-control', `max-age=${browserTTL}, s-maxage=${cdnTTL}, must-revalidate`);
      break;
    default:
      break;
  }

  // BYO CDN cache tags
  // apply cache tags: transform Fastly Surrogate-Key to Cloudflare Cache-Tag
  if (cacheKeys.length) {
    switch (byo_cdn_type) {
      case 'fastly':
        resp.headers.set('surrogate-key', cacheKeys.join(' '));
        break;
      case 'akamai':
        resp.headers.set('edge-cache-tag', cacheKeys.join(' '));
        break;
      case 'cloudflare':
        resp.headers.set('cache-tag', `${cacheKeys.join(',')}`);
        break;
      case 'cloudfront':
        // cloudfront doesn't support cache tags/keys ...
        break;
      default:
        break;
    }
  }
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

/**
 * Sets the cache headers for a product
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} resp
 * @returns {Promise<void>}
 */
export async function setMediaCacheHeaders(state, req, resp) {
  const { org, site } = state;
  const url = new URL(req.url);
  const keys = await computeMediaKeys(org, site, url.pathname);

  setCachingHeaders(req, resp, keys);
}
