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

const HREFLANG_PREFIX = 'hreflang-';

/**
 * Title and description metadata, resolved by precedence below rather than emitted as-is.
 */
const RESOLVED_NAMES = new Set([
  'title', 'og:title', 'twitter:title',
  'description', 'og:description', 'twitter:description',
]);

/**
 * Collects explicitly set title and description metadata (authored on the page, or set on
 * the product). Names are matched case-insensitively; later entries win, and empty values
 * count as not set.
 *
 * @param {Record<string, string>|undefined} metadata
 * @returns {Record<string, string>}
 */
function explicitValues(metadata) {
  /** @type {Record<string, string>} */
  const explicit = {};
  Object.entries(metadata ?? {}).forEach(([key, value]) => {
    const name = key.toLowerCase();
    if (RESOLVED_NAMES.has(name) && value) {
      explicit[name] = value;
    }
  });
  return explicit;
}

/**
 * @param {PipelineState} state
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
    metaImage,
    type,
    metadata,
  } = content.data;

  const ogImage = constructImageUrl(state, metaImage || images[0]?.url);
  const head = select('head', hast);

  // Precedence for title and description: explicitly authored metadata, then Product Bus
  // data. og:* inherits the resolved value, and twitter:* inherits og:*, unless set
  // explicitly. Product Bus always has a `name`, so a title generated from the authored page
  // is never used; a generated description is used only when Product Bus has none.
  const explicit = explicitValues(metadata);
  const headTitle = explicit.title || metaTitle || name;
  const ogTitle = explicit['og:title'] || headTitle;
  const twitterTitle = explicit['twitter:title'] || ogTitle;
  const headDescription = explicit.description
    || metaDescription
    || limitWords(stripHTML(description))
    || content.implicitDescription
    || '';
  const ogDescription = explicit['og:description'] || headDescription;
  const twitterDescription = explicit['twitter:description'] || ogDescription;

  head.children = [
    h('title', headTitle),
    h('link', { rel: 'canonical', href: url }),
    h('meta', { name: 'description', content: headDescription }),
    h('meta', { property: 'og:title', content: ogTitle }),
    h('meta', { property: 'og:description', content: ogDescription }),
    h('meta', { property: 'og:url', content: url }),
    h('meta', { property: 'og:image', content: ogImage }),
    h('meta', { name: 'twitter:card', content: 'summary_large_image' }),
    h('meta', { name: 'twitter:title', content: twitterTitle }),
    h('meta', { name: 'twitter:description', content: twitterDescription }),
    h('meta', { name: 'twitter:image', content: ogImage }),
    h('meta', { name: 'sku', content: sku }),
  ];

  if (type) {
    head.children.push(h('meta', { name: 'type', content: type }));
  }

  // Add product metadata to the head.
  // Metadata takes precedence over PB-generated values: if a meta tag with the
  // same name was already emitted above, replace its content instead of emitting
  // a duplicate. Names are compared case-insensitively, as HTML meta names are.
  // Titles and descriptions were already resolved above.
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (RESOLVED_NAMES.has(lowerKey)) {
        return;
      }

      if (lowerKey.startsWith(HREFLANG_PREFIX)) {
        const localeRaw = key.substring(HREFLANG_PREFIX.length);
        if (localeRaw && value) {
          const hreflang = localeRaw.replaceAll('_', '-').toLowerCase();
          head.children.push(h('link', { rel: 'alternate', hreflang, href: value }));
        }
        return;
      }

      const existing = head.children.find((child) => {
        const metaName = child.type === 'element' && child.tagName === 'meta'
          ? child.properties?.name
          : undefined;
        return typeof metaName === 'string' && metaName.toLowerCase() === lowerKey;
      });
      if (existing) {
        existing.properties.content = value;
      } else {
        head.children.push(h('meta', { name: key, content: value }));
      }
    });
  }

  // inject head.html
  const headHtml = state.config?.head?.html;
  if (headHtml) {
    const $headHtml = await unified()
      .use(rehypeParse, { fragment: true })
      .parse(headHtml);
    // @ts-ignore
    head.children.push(...$headHtml.children);
  }
}
