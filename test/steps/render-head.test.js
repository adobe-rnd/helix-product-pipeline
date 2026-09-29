/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import assert from 'node:assert/strict';
import { select } from 'hast-util-select';
import { h } from 'hastscript';
import renderHead from '../../src/steps/render-head.js';

const SOCIAL_TAGS = [
  ['property', 'og:image'],
  ['name', 'twitter:image'],
];

async function renderSocialTags(product) {
  const hast = h('html', [h('head'), h('body')]);
  await renderHead({
    content: {
      hast,
      data: {
        sku: 'social-sku',
        name: 'Social Product',
        description: '',
        url: 'https://www.example.com/us/en_us/products/social',
        ...product,
      },
    },
    info: { pathPrefix: '/us/en_us/products' },
    partition: 'live',
    prodHost: 'www.example.com',
  });
  return select('head', hast).children;
}

describe('render-head social images', () => {
  const cases = [
    {
      name: 'uses a relative metaImage when the gallery is empty',
      product: { metaImage: './media_social.png', images: [] },
      expected: 'https://www.example.com/us/en_us/products/media_social.png',
    },
    {
      name: 'preserves an absolute metaImage URL including query parameters over the gallery',
      product: {
        metaImage: 'https://cdn.example.com/share.jpg?width=1200&format=jpg',
        images: [{ url: './media_gallery.png' }],
      },
      expected: 'https://cdn.example.com/share.jpg?width=1200&format=jpg',
    },
    {
      name: 'resolves a root-relative metaImage before the first gallery image',
      product: { metaImage: '/media/social.png', images: [{ url: './media_gallery.png' }] },
      expected: 'https://www.example.com/us/en_us/products/media/social.png',
    },
    {
      name: 'uses the first gallery image when metaImage is omitted',
      product: { images: [{ url: './first.png' }, { url: './second.png' }] },
      expected: 'https://www.example.com/us/en_us/products/first.png',
    },
    {
      name: 'uses the first gallery image when metaImage is empty',
      product: { metaImage: '', images: [{ url: './first.png' }, { url: './second.png' }] },
      expected: 'https://www.example.com/us/en_us/products/first.png',
    },
    {
      name: 'leaves both social image tags empty without either image source',
      product: { images: [] },
      expected: '',
    },
  ];

  for (const { name, product, expected } of cases) {
    it(name, async () => {
      const children = await renderSocialTags(product);
      for (const [key, value] of SOCIAL_TAGS) {
        const tags = children.filter((child) => child.tagName === 'meta' && child.properties[key] === value);
        assert.equal(tags.length, 1, `expected one ${value} tag`);
        assert.equal(tags[0].properties.content, expected, `${value} image URL`);
      }
    });
  }
});
