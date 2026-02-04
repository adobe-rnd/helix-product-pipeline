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

const BYO_CDN_TYPES = ['akamai', 'cloudflare', 'fastly', 'cloudfront'];

/**
 * Detects the BYO CDN type from the request headers.
 *
 * @param {Request|object} req - The request object (must have headers)
 * @returns {string|undefined} - The detected CDN type or undefined
 */
const detectByoCdnType = (req) => {
  const { headers } = req;
  let byoCdnType = headers.get('x-byo-cdn-type');
  const via = headers.get('via') || '';
  const cdnLoop = headers.get('cdn-loop') || '';

  if (!BYO_CDN_TYPES.includes(byoCdnType)) {
    if (/[Aa]kamai/.test(via)) {
      byoCdnType = 'akamai';
    } else if (via.includes('varnish') || cdnLoop.startsWith('Fastly')) {
      byoCdnType = 'fastly';
    } else if (cdnLoop.includes('cloudflare') || headers.has('cf-worker')) {
      byoCdnType = 'cloudflare';
    } else if (via.includes('CloudFront')) {
      byoCdnType = 'cloudfront';
    } else {
      byoCdnType = undefined;
    }
  }

  return BYO_CDN_TYPES.includes(byoCdnType) ? byoCdnType : undefined;
};

/**
 * Applies BYO CDN specific cache headers to the response.
 *
 * @param {Response|object} resp - The response object
 * @param {Request|object} req - The request object
 * @param {string[]} cacheKeys - List of cache keys/tags
 * @param {number} browserTTL - Browser TTL in seconds
 * @param {number} cdnTTL - CDN TTL in seconds
 */
export const applyByoCdnHeaders = (resp, req, cacheKeys, browserTTL, cdnTTL) => {
  const byoCdnType = detectByoCdnType(req);
  const keys = cacheKeys && cacheKeys.length ? cacheKeys : [];

  switch (byoCdnType) {
    case 'cloudflare':
      resp.headers.set('cdn-cache-control', `max-age=${cdnTTL}, must-revalidate`);
      if (keys.length) resp.headers.set('cache-tag', keys.join(','));
      break;
    case 'fastly':
      resp.headers.set('surrogate-control', `max-age=${cdnTTL}, stale-while-revalidate=0`);
      if (keys.length) resp.headers.set('surrogate-key', keys.join(' '));
      break;
    case 'akamai':
      resp.headers.set('edge-control', `!no-store,max-age=${cdnTTL}s,downstream-ttl=${browserTTL}s`);
      if (keys.length) resp.headers.set('edge-cache-tag', keys.join(' '));
      break;
    case 'cloudfront':
      resp.headers.set('cache-control', `max-age=${browserTTL}, s-maxage=${cdnTTL}, must-revalidate`);
      break;
    default:
      break;
  }
};
