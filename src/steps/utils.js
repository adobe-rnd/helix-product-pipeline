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

/**
 * Slugify a SKU by converting it to lowercase, replacing spaces with hyphens,
 * @param {string} sku
 * @returns {string}
 */
export function slugger(sku) {
  if (typeof sku !== 'string') return '';
  return sku
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\//g, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns the original host name from the request to the outer CDN.
 * @param {object} headers The request headers
 * @returns {string} The original host
 */
export function getOriginalHost(headers) {
  const xfh = headers.get('x-forwarded-host');
  if (xfh) {
    const segs = xfh.split(',');
    for (const seg of segs) {
      const host = seg.trim();
      if (host) {
        return host;
      }
    }
  }
  return headers.get('host');
}
