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
import { constructImageUrl } from './create-pictures.js';
import { limitWords, stripHTML } from './utils.js';

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function render(state) {
  const { content } = state;
  const { hast } = content;

  const {
    metaTitle,
    name,
    description,
    metaDescription,
    url,
    sku,
    images = [],
    type,
    metadata,
  } = content.data;

  const ogImage = constructImageUrl(state, images[0]?.url);
  const head = select('head', hast);
  const headDescription = metaDescription || limitWords(stripHTML(description));
  head.children = [
    h('title', metaTitle || name),
    h('link', { rel: 'canonical', href: url }),
    h('meta', { name: 'description', content: headDescription }),
    h('meta', { property: 'og:title', content: metaTitle || name }),
    h('meta', { property: 'og:description', content: headDescription }),
    h('meta', { property: 'og:url', content: url }),
    h('meta', { property: 'og:image', content: ogImage }),
    h('meta', { name: 'twitter:card', content: 'summary_large_image' }),
    h('meta', { name: 'twitter:title', content: metaTitle || name }),
    h('meta', { name: 'twitter:description', content: headDescription }),
    h('meta', { name: 'twitter:image', content: ogImage }),
    h('meta', { name: 'sku', content: sku }),
  ];

  if (type) {
    head.children.push(h('meta', { name: 'type', content: type }));
  }

  // Add product metadata to the head
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      head.children.push(h('meta', { name: key, content: value }));
    });
  }

  // inject head.html
  const headHtml = state.config?.head?.html;
  if (headHtml) {
    const $headHtml = await unified()
      .use(rehypeParse, { fragment: true })
      .parse(headHtml);
    head.children.push(...$headHtml.children);
  }
}
