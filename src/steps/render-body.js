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
function formatPrice(price) {
  if (!price) return '';
  const { regular, final } = price;
  if (final < regular) {
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
 * Render the product content.
 * @param {string} edge
 * @param {string} description
 * @returns {import('hast').Element | import('hast').Root}
 */
function renderProductContent(edge, description) {
  // If content exists in edge, use it, otherwise use description
  if (edge) {
    return (fromHtml(edge, { fragment: true }));
  }

  if (!description) {
    return undefined;
  }

  const descriptionIsHTML = maybeHTML(description);
  const descriptionNode = descriptionIsHTML ? fromHtml(description, { fragment: true }) : h('p', description);
  return h('div', descriptionNode);
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
  const { hast, edge } = content;

  const {
    name,
    description,
    images = [],
    price,
    variants = [],
  } = content.data;

  const productContent = renderProductContent(edge, description);

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
