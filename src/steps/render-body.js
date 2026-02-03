/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-disable max-len */
import { select } from 'hast-util-select';
import { h } from 'hastscript';
import { fromHtml } from 'hast-util-from-html';
import { slug } from 'github-slugger';
import { createOptimizedPicture } from './create-pictures.js';
import { maybeHTML } from './utils.js';

/**
 * Format price with sale logic using HAST nodes.
 * @param {Object} price
 * @returns {Object} HAST node
 */
export function formatPrice(price) {
  if (!price) return '';
  const { regular, final } = price;
  if (parseFloat(final) < parseFloat(regular)) {
    return h('p', [`$${final} `, '(', h('del', `$${regular}`), ')']);
  }
  return h('p', `$${final}`);
}

// Render media. Image first than anchor if video
function renderMedia(media) {
  const { url, alt, title } = media;
  if (media.video) {
    return h('p', [
      createOptimizedPicture(url, alt, title),
      h('a', { href: media.video }, 'Video'),
    ]);
  }
  return h('p', createOptimizedPicture(url, alt, title));
}

/**
 * Rewrite a single URL to include /content-images/ prefix for media files.
 * @param {string} url - The URL to potentially rewrite
 * @returns {string} The rewritten URL
 */
function rewriteMediaUrl(url) {
  /* c8 ignore next */
  if (!url) return url;
  return url.replace(/\/(media_[a-f0-9]+\.\w+)/g, '/content-images/$1');
}

/**
 * Recursively rewrite image URLs in HAST nodes to include /content-images/ prefix.
 * This allows the aem.network to route these images back to aem.live instead of the product media bus.
 * @param {import('hast').Root|import('hast').Element} node - HAST node to process
 */
export function rewriteContentImageUrls(node) {
  /* c8 ignore next */
  if (!node) return;

  // Rewrite src and srcset attributes on img and source elements
  if (node.type === 'element' && node.properties) {
    if (node.tagName === 'img' || node.tagName === 'source') {
      if (node.properties.src && typeof node.properties.src === 'string') {
        node.properties.src = rewriteMediaUrl(node.properties.src);
      }
      if (node.properties.srcSet && typeof node.properties.srcSet === 'string') {
        node.properties.srcSet = rewriteMediaUrl(node.properties.srcSet);
      }
    }
  }

  // Recursively process children
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'element') {
        rewriteContentImageUrls(child);
      }
    }
  }
}

/**
 * Render the product content.
 * @param {import('hast').Root} edgeHast - HAST nodes from authored content
 * @param {string} description - Product description (may be HTML or plain text)
 * @returns {import('hast').Element | import('hast').Root}
 */
function renderProductContent(edgeHast, description) {
  const parts = [];

  // Add description first if it exists
  if (description) {
    const descriptionIsHTML = maybeHTML(description);
    if (descriptionIsHTML) {
      const descriptionFragment = fromHtml(description, { fragment: true });
      parts.push(h('div', descriptionFragment.children));
    } else {
      parts.push(h('div', h('p', description)));
    }
  }

  // Add edge content after if it exists (already HAST, just rewrite URLs)
  if (edgeHast) {
    rewriteContentImageUrls(edgeHast);
    parts.push(...edgeHast.children);
  }

  // Return undefined if nothing to render
  if (parts.length === 0) {
    return undefined;
  }

  return { type: 'root', children: parts };
}

function variantDataAttrs(variant) {
  const { sku, options } = variant;
  const attrs = {};
  if (sku) attrs['data-sku'] = String(sku);
  for (const opt of (options || [])) {
    const base = `data-${slug(opt.id)}`;
    if (opt.value != null) attrs[base] = String(opt.value);
    if (opt.uid != null) attrs['data-uid'] = String(opt.uid);
  }
  return attrs;
}

/**
 * Render the body of the product page.
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function render(state, req, res) {
  const { content } = state;
  const { hast, edgeHast } = content;

  const {
    name,
    description,
    images = [],
    price,
    variants = [],
  } = content.data;

  const productContent = renderProductContent(edgeHast, description);

  const main = select('main', hast);
  main.children = [
    h('div', [
      h('h1', name),
      formatPrice(price),
      ...(images?.length > 0 ? images.map((img) => renderMedia(img)) : []),
    ]),
  ];

  if (productContent) {
    // @ts-ignore
    main.children.push(productContent);
  }

  if (variants.length > 0) {
    main.children.push(...variants.map((variant) => h('div', { className: 'section', ...variantDataAttrs(variant) }, [
      h('h2', variant.name),
      formatPrice(variant.price),
      ...(variant.images?.length > 0 ? variant.images.map((img) => h('p', createOptimizedPicture(img.url, img.alt, img.title))) : []),
    ])));
  }

  res.document = hast;
}
