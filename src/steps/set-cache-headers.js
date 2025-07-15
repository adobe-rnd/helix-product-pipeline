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

import { computeSurrogateKey } from '@adobe/helix-shared-utils';

export const isMediaRequest = (url) => /\/media_[0-9a-f]{40,}[/a-zA-Z0-9_-]*\.[0-9a-z]+$/.test(url.pathname);
const BYO_CDN_TYPES = ['akamai', 'cloudflare', 'fastly', 'cloudfront'];

/**
 * Returns the surrogate key for a content-bus resource
 * based on the contentBusId and the resource path
 * @param state
 * @returns {Promise<string>}
 */
export async function computeContentPathKey(state) {
  const { contentBusId, info } = state;
  const { path } = info;
  return computeSurrogateKey(`${contentBusId}${path}`);
}

/**
 * Returns the surrogate key for a code-bus resource
 * based on the repositry and the resource path
 * @param state
 * @returns {Promise<string>}
 */
export async function computeCodePathKey(state) {
  const {
    owner, repo, ref, info: { path },
  } = state;
  return computeSurrogateKey(`${ref}--${repo}--${owner}${path}`);
}

export async function computeProductKeys(state) {
  const keys = [];
  const { content, config } = state;
  const { sku, urlKey } = content.data || config.route.params;
  const { storeCode, storeViewCode } = config.route.params;

  if (sku) {
    keys.push(await computeSurrogateKey(`/${storeCode}/${storeViewCode}/${sku}`));
  }

  if (urlKey) {
    keys.push(await computeSurrogateKey(`/${storeCode}/${storeViewCode}/${urlKey}`));
  }

  return keys;
}

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @returns {Promise<string[]>}
 */
export default async function computeContentSurrogateKeys(state) {
  const {
    contentBusId, owner, repo, ref,
  } = state;

  // We don't use partitions and everything is considered live
  // so contentKeyPrefix is not needed (no p_)
  const contentKeyPrefix = '';
  const keys = [];
  const hash = await computeContentPathKey(state);
  keys.push(`${contentKeyPrefix}${hash}`);
  keys.push(`${contentKeyPrefix}${contentBusId}_metadata`);
  keys.push(`${ref}--${repo}--${owner}_head`);
  keys.push(`${contentKeyPrefix}${contentBusId}`);

  keys.push(...(await computeProductKeys(state)));

  return keys;
}

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @returns {Promise<string[]>}
 */
export async function computeJSONSurrogateKeys(state) {
  const keys = [];
  // We don't use partitions and everything is considered live
  // so contentKeyPrefix is not needed (no p_)
  const contentKeyPrefix = '';
  keys.push(`${contentKeyPrefix}${await computeContentPathKey(state)}`);
  keys.push(`${contentKeyPrefix}${state.contentBusId}`);

  keys.push(...(await computeProductKeys(state)));

  return keys;
}

export async function compute404Keys(state) {
  const {
    contentBusId, owner, repo, ref,
  } = state;

  // We don't use partitions and everything is considered live
  // so contentKeyPrefix is not needed (no p_)
  const contentKeyPrefix = '';
  const keys = [];
  keys.push(`${contentKeyPrefix}${await computeContentPathKey(state)}`);
  keys.push(`${contentKeyPrefix}${contentBusId}`);

  // code keys
  keys.push(await computeCodePathKey(state));
  keys.push(`${ref}--${repo}--${owner}_404`);
  keys.push(`${ref}--${repo}--${owner}_code`);

  keys.push(...(await computeProductKeys(state)));

  return keys;
}

export function setCachingHeaders(state, req, resp, cacheKeys) {
  const {
    ref, site, org,
  } = state;
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
      browserTTL = resp.ok ? 2592000 : 3600;
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
    cdnTTL = resp.ok ? 2592000 : 3600;
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
  const rsoKey = `${ref}--${site}--${org}`;
  if (cacheKeys.length) {
    switch (byo_cdn_type) {
      case 'fastly':
        resp.headers.set('surrogate-key', cacheKeys.join(' '));
        break;
      case 'akamai':
        resp.headers.set('edge-cache-tag', cacheKeys.join(' '));
        break;
      case 'cloudflare':
        resp.headers.set('cache-tag', `${cacheKeys.join(',')},${rsoKey}${url.pathname},${url.pathname}`);
        break;
      case 'cloudfront':
        // cloudfront doesn't support cache tags/keys ...
        break;
      default:
        break;
    }
  }
}
