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

function createBlock(name, content) {
  return h('div', { className: name }, [
    h('div', [
      h('div', fromHtml(content, { fragment: true })),
    ]),
  ]);
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
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function render(state, req, res) {
  const { content } = state;
  const { hast } = content;

  const {
    name,
    description,
    specifications,
    images = [],
    price,
    variants = [],
  } = content.data;

  const descriptionIsHTML = maybeHTML(description);

  const main = select('main', hast);
  main.children = [
    h('div', [
      h('h1', name),
      formatPrice(price),
      descriptionIsHTML ? fromHtml(description, { fragment: true }) : h('p', description),
      specifications ? createBlock('specifications', specifications) : null,
      ...(images?.length > 0 ? images.map((img) => renderMedia(img)) : []),
    ]),
    ...variants.map((variant) => h('div', [
      h('h2', variant.name),
      ...(variant.images?.length > 0 ? variant.images.map((img) => h('p', createOptimizedPicture(img.url, img.alt, img.title))) : []),
      formatOptions(variant),
    ])),
  ];

  res.document = hast;
}
