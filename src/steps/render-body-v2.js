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

function formatOptions(variant) {
  const { sku, options } = variant;
  if (!options) return '';

  const sectionMetadata = h('div.section-metadata', [
    h('div', [
      h('div', 'sku'),
      h('div', sku),
    ]),
    ...options.map((option) => h('div', [
      h('div', option.id),
      h('div', option.value),
      option.uid ? h('div', option.uid) : null,
    ])),
  ]);

  return sectionMetadata;
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

function renderProductContent(edge, description) {
  // If content exists in edge, use it, otherwise use description
  if (edge) {
    return fromHtml(edge, { fragment: true });
  }

  const descriptionIsHTML = maybeHTML(description);
  const descriptionNode = descriptionIsHTML ? fromHtml(description, { fragment: true }) : h('p', description);
  return h('div', descriptionNode);
}

/**
 * @type PipelineStep
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
    productContent,
    ...variants.map((variant) => h('div', { className: 'variant' }, [
      h('h2', variant.name),
      formatPrice(variant.price),
      ...(variant.images?.length > 0 ? variant.images.map((img) => h('p', createOptimizedPicture(img.url, img.alt, img.title))) : []),
      formatOptions(variant),
    ])),
  ];

  res.document = hast;
}
