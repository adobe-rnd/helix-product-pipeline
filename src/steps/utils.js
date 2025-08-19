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

/* eslint-disable no-continue */

/**
 * Slugify a SKU by converting it to lowercase, replacing spaces with hyphens,
 * @param {string} sku
 * @returns {string}
 */
export function slugger(sku) {
  if (typeof sku !== 'string') return '';
  return sku
    .toLowerCase()
    .replace(/[_//]/g, '-') // Replace underscores and forward slashes with hyphens
    .replace(/[^a-z0-9\s-]/g, '') // Remove all characters except a-z, 0-9, spaces, and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens into single hyphen
    .replace(/^-+/, '') // Remove leading hyphens
    .replace(/-+$/, ''); // Remove trailing hyphens
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

/**
 * Guess if a string is HTML by checking if it starts or ends with a tag.
 * Written to be fast but not perfect in terms of accuracy.
 * @param {string} str
 * @returns {boolean}
 */
export function maybeHTML(str) {
  if (typeof str !== 'string' || str.length < 3) return false;
  if (str.startsWith('<?') || str.startsWith('<!')) return false;

  const trimmed = str.trim();
  const startsWithTag = trimmed[0] === '<' && trimmed.indexOf('>') > 1;
  const endsWithTag = trimmed.lastIndexOf('<') < trimmed.length - 1 && trimmed.endsWith('>');

  return startsWithTag || endsWithTag;
}

/**
 * Strip HTML tags from a string.
 * @param {string} html
 * @returns {string}
 */
export function stripHTML(html) {
  if (!html) return '';

  let text = '';
  let insideTag = false;

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < html.length; i++) {
    const char = html[i];

    if (char === '<') {
      insideTag = true;
      continue;
    }

    if (char === '>') {
      insideTag = false;
      text += ' '; // insert space after closing tag
      continue;
    }

    if (!insideTag) {
      text += char;
    }
  }

  // Decode common HTML entities (basic replacements only)
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Collapse whitespace and trim
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts a description from a string, trimmed to max words.
 * Adds " ..." if truncated.
 * @param {string} text
 * @param {number} maxWords
 * @returns {string}
 */
export function limitWords(text, maxWords = 25) {
  if (!text) return '';

  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}
