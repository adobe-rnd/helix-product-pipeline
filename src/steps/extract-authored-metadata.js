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

import { selectAll, select } from 'hast-util-select';
import { fromHtml } from 'hast-util-from-html';

/**
 * Set of meta tag names to ignore when extracting authored metadata.
 * These are standard meta tags that we don't want to override.
 */
const IGNORED_META_NAMES = new Set([
  'viewport',
]);

/**
 * Prefixes for meta tag names to ignore.
 * og: and twitter: prefixes are standard social meta tags.
 */
const IGNORED_META_PREFIXES = ['og:', 'twitter:'];

/**
 * Check if a meta tag name should be ignored.
 * @param {string} name - The meta tag name
 * @returns {boolean} True if the name should be ignored
 */
function shouldIgnoreMetaName(name) {
  if (!name) return true;
  if (IGNORED_META_NAMES.has(name)) return true;
  return IGNORED_META_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Extract metadata from the head element of an HTML document.
 * Only extracts meta tags with name attribute (not property).
 * Ignores og:*, twitter:*, and viewport meta tags.
 *
 * @param {import('hast').Element} head - The head element
 * @returns {Object} Extracted metadata key/value pairs
 */
function extractMetadataFromHead(head) {
  const metadata = {};

  /* c8 ignore next */
  if (!head) return metadata;

  // Select all meta tags with a name attribute
  const metaTags = selectAll('meta[name]', head);

  for (const meta of metaTags) {
    const name = meta.properties?.name;
    const content = meta.properties?.content;

    // Only add if name is valid and content exists
    if (typeof name === 'string' && !shouldIgnoreMetaName(name) && content !== undefined) {
      metadata[name] = content;
    }
  }

  return metadata;
}

/**
 * Extract the main element's children as HAST nodes.
 * @param {import('hast').Root} hast - The parsed HTML document
 * @returns {import('hast').Root|undefined} HAST root with main's children,
 * or undefined if not found
 */
function extractMainContent(hast) {
  const main = select('main', hast);
  if (!main || !main.children || main.children.length === 0) {
    return undefined;
  }

  // Return main's children as a HAST root node
  return { type: 'root', children: main.children };
}

/**
 * Extract metadata and body content from authored HTML document.
 *
 * @param {PipelineState} state - Pipeline state object
 * @returns {Promise<void>}
 */
export default async function extractAuthoredMetadata(state) {
  const { content } = state;
  const { edge, data } = content;

  if (!edge) {
    return;
  }

  const hast = fromHtml(edge, { fragment: false });
  const head = select('head', hast);
  const authoredMetadata = extractMetadataFromHead(head);

  // If metadata was extracted, merge it with existing product metadata
  if (Object.keys(authoredMetadata).length > 0) {
    if (!data.metadata) {
      data.metadata = {};
    }

    // Authored metadata takes precedence
    Object.assign(data.metadata, authoredMetadata);
  }

  // Extract main content as HAST and store for render-body to use directly
  const mainContent = extractMainContent(hast);
  if (mainContent) {
    content.edgeHast = mainContent;
  }
}
