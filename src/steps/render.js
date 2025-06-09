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
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { fromHtml } from 'hast-util-from-html';
import { createOptimizedPicture } from './create-pictures.js';

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
  if (media.video) {
    return h('p', [
      createOptimizedPicture(media.url),
      h('a', { href: media.video }, 'Video'),
    ]);
  }
  return h('p', createOptimizedPicture(media.url));
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
    metaTitle,
    metaDescription,
    url,
    sku,
    name,
    description,
    specifications,
    images = [],
    price,
    variants = [],
    custom,
  } = content.data;

  const head = select('head', hast);
  head.children = [
    h('title', metaTitle),
    h('link', { rel: 'canonical', href: url }),
    h('meta', { name: 'description', content: metaDescription }),
    h('meta', { property: 'og:title', content: metaTitle }),
    h('meta', { property: 'og:description', content: metaDescription }),
    h('meta', { property: 'og:url', content: url }),
    h('meta', { property: 'og:image', content: images[0]?.url }),
    h('meta', { name: 'twitter:card', content: 'summary_large_image' }),
    h('meta', { name: 'twitter:title', content: metaTitle }),
    h('meta', { name: 'twitter:description', content: metaDescription }),
    h('meta', { name: 'twitter:image', content: images[0]?.url }),
    h('meta', { name: 'robots', content: 'noindex' }),
    h('meta', { name: 'sku', content: sku }),
  ];

  // Any string value in custom should be added to the head
  Object.entries(custom).forEach(([key, value]) => {
    if (typeof value === 'string') {
      head.children.push(h('meta', { name: key, content: value }));
    }
  });

  // inject head.html
  const headHtml = state.config?.head?.html;
  if (headHtml) {
    const $headHtml = await unified()
      .use(rehypeParse, { fragment: true })
      .parse(headHtml);
    head.children.push(...$headHtml.children);
  }

  const main = select('main', hast);
  main.children = [
    h('div', [
      h('h1', name),
      formatPrice(price),
      fromHtml(description, { fragment: true }),
      specifications ? createBlock('specifications', specifications) : null,
      ...images.map((img) => renderMedia(img)),
    ]),
    ...variants.map((variant) => h('div', [
      h('h2', variant.name),
      ...variant.images.map((img) => h('p', createOptimizedPicture(img.url))),
      formatOptions(variant),
    ])),
  ];

  res.document = hast;
}
