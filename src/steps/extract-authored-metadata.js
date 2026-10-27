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
import { toString } from 'hast-util-to-string';
import { visit, EXIT, CONTINUE } from 'unist-util-visit';

/**
 * Set of meta tag names to ignore when extracting authored metadata.
 * These are standard meta tags that we don't want to override.
 * `description` is handled separately by {@link extractDescriptions}.
 */
const IGNORED_META_NAMES = new Set([
  'viewport',
  'description',
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
 * Port of `extractDescription()` from helix-html-pipeline (src/steps/extract-metadata.js).
 * When a page has no explicitly authored description, the HTML pipeline generates one from
 * the first `div > p` that has at least 10 words (or a word longer than 25 characters that is
 * not a URL), truncated to 25 words. Keep in sync with the HTML pipeline.
 *
 * Known gap: the served HTML loses whitespace around icons and after hard line breaks, so a
 * paragraph containing either won't match and its excerpt is treated as authored.
 *
 * @param {import('hast').Root} main - The page's main content
 * @returns {string} The description the HTML pipeline would generate, or ''
 */
function generatedDescription(main) {
  let desc = '';
  visit(main, 'element', (node, idx, parent) => {
    if (parent?.type === 'element' && parent.tagName === 'div' && node.tagName === 'p') {
      const words = toString(node).trim().split(/\s+/);
      if (words.length >= 10 || words.some((w) => w.length > 25 && !w.startsWith('http'))) {
        desc = `${words.slice(0, 25).join(' ')}${words.length > 25 ? ' ...' : ''}`;
        return EXIT;
      }
    }
    return CONTINUE;
  });
  return desc;
}

/**
 * @param {import('hast').Element|undefined} head
 * @param {string} selector
 * @returns {string} The meta tag's content, or '' when missing
 */
function metaContent(head, selector) {
  const content = head && select(selector, head)?.properties?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Separates explicitly authored descriptions from the ones the HTML pipeline generates.
 *
 * The HTML pipeline renders `description`, `og:description` and `twitter:description` whether
 * or not they were authored:
 * - `description` falls back to an excerpt of the page body ({@link generatedDescription}),
 * - `og:description` falls back to `description`,
 * - `twitter:description` falls back to `og:description`.
 * A value that differs from its fallback was set explicitly (in the page's metadata block, or
 * in bulk metadata). Empty values are treated as not set.
 *
 * @param {import('hast').Element|undefined} head
 * @param {import('hast').Root|undefined} main
 * @returns {{ explicit: Record<string, string>, implicitDescription?: string }}
 */
function extractDescriptions(head, main) {
  const description = metaContent(head, 'meta[name="description"]');
  const ogDescription = metaContent(head, 'meta[property="og:description"]');
  const twitterDescription = metaContent(head, 'meta[name="twitter:description"]');

  /** @type {Record<string, string>} */
  const explicit = {};
  let implicitDescription;
  if (description) {
    if (main && description === generatedDescription(main)) {
      implicitDescription = description;
    } else {
      explicit.description = description;
    }
  }
  if (ogDescription && ogDescription !== description) {
    explicit['og:description'] = ogDescription;
  }
  if (twitterDescription && twitterDescription !== ogDescription) {
    explicit['twitter:description'] = twitterDescription;
  }
  return { explicit, implicitDescription };
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
  const mainContent = extractMainContent(hast);
  const { explicit, implicitDescription } = extractDescriptions(head, mainContent);
  const authoredMetadata = { ...extractMetadataFromHead(head), ...explicit };

  // A generated description is only used when product data has none (see render-head).
  if (implicitDescription) {
    content.implicitDescription = implicitDescription;
  }

  // If metadata was extracted, merge it with existing product metadata
  if (Object.keys(authoredMetadata).length > 0) {
    if (!data.metadata) {
      data.metadata = {};
    }

    // Authored metadata takes precedence
    Object.assign(data.metadata, authoredMetadata);
  }

  // Store main content as HAST for render-body to use directly
  if (mainContent) {
    content.edgeHast = mainContent;
  }
}
