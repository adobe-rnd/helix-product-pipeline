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

/**
 * Runs the render-head step against a minimal state and returns the head's children.
 * @param {object} data product data (incl. optional `metadata`)
 * @param {object} [extraContent] additional `state.content` props (e.g. `implicitDescription`)
 * @returns {Promise<import('hast').ElementContent[]>}
 */
async function renderHeadChildren(data, extraContent = {}) {
  const head = h('head');
  const state = {
    info: { pathPrefix: '/' },
    partition: 'live',
    config: {},
    content: {
      hast: { type: 'root', children: [h('html', [head])] },
      data: {
        name: 'Test Product',
        description: 'Generated description',
        url: 'https://acme.com/products/test',
        sku: 'GEN-SKU',
        ...data,
      },
      ...extraContent,
    },
  };
  await renderHead(state);
  return head.children;
}

/**
 * @param {import('hast').ElementContent[]} children
 * @param {string} name meta name, compared case-insensitively
 */
function metasNamed(children, name) {
  return children.filter(
    (child) => child.type === 'element'
      && child.tagName === 'meta'
      && typeof child.properties?.name === 'string'
      && child.properties.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * @param {import('hast').ElementContent[]} children
 * @returns {{ title: unknown[], og: unknown[], twitter: unknown[] }} text of each <title>,
 *   and content of each og:title (via `property`) and twitter:title (via `name`) tag
 */
function titleTags(children) {
  const elements = children.filter((c) => c.type === 'element');
  const contentOf = (match) => elements
    .filter((c) => c.tagName === 'meta' && match(c.properties))
    .map((c) => c.properties.content);
  return {
    title: elements.filter((c) => c.tagName === 'title').map((c) => c.children[0]?.value),
    og: contentOf((p) => p.property === 'og:title'),
    twitter: contentOf((p) => p.name === 'twitter:title'),
  };
}

/**
 * @param {import('hast').ElementContent[]} children
 * @returns {{ description: unknown[], og: unknown[], twitter: unknown[] }} content of each
 *   description tag (og:description via `property`, the others via `name`)
 */
function descriptionTags(children) {
  const contentOf = (match) => children
    .filter((c) => c.type === 'element' && c.tagName === 'meta' && match(c.properties))
    .map((c) => c.properties.content);
  return {
    description: contentOf((p) => p.name === 'description'),
    og: contentOf((p) => p.property === 'og:description'),
    twitter: contentOf((p) => p.name === 'twitter:description'),
  };
}

describe('render-head', () => {
  describe('authored metadata precedence', () => {
    it('overrides the generated description in place so only one tag renders', async () => {
      const children = await renderHeadChildren({ metadata: { description: 'Authored description' } });

      const descriptions = metasNamed(children, 'description');
      assert.strictEqual(descriptions.length, 1, 'exactly one description meta');
      assert.strictEqual(descriptions[0].properties.content, 'Authored description');
    });

    it('matches meta names case-insensitively (Description overrides description)', async () => {
      const children = await renderHeadChildren({ metadata: { Description: 'Authored description' } });

      const descriptions = metasNamed(children, 'description');
      assert.strictEqual(descriptions.length, 1, 'exactly one description meta');
      assert.strictEqual(descriptions[0].properties.content, 'Authored description');
    });

    it('collapses metadata keys that differ only by case into a single tag', async () => {
      const children = await renderHeadChildren({ metadata: { Robots: 'noindex', robots: 'nofollow' } });

      const robots = metasNamed(children, 'robots');
      assert.strictEqual(robots.length, 1, 'exactly one robots meta');
      assert.strictEqual(robots[0].properties.content, 'nofollow', 'last value wins');
    });

    it('appends metadata that does not collide with a generated tag', async () => {
      const children = await renderHeadChildren({ metadata: { robots: 'noindex' } });

      const robots = metasNamed(children, 'robots');
      assert.strictEqual(robots.length, 1);
      assert.strictEqual(robots[0].properties.content, 'noindex');
      assert.strictEqual(metasNamed(children, 'description').length, 1, 'generated description kept');
    });

    it('overrides every generated meta name, not just description (sku, type, twitter:*)', async () => {
      const children = await renderHeadChildren({
        type: 'simple',
        metadata: {
          sku: 'AUTHORED-SKU',
          type: 'authored-type',
          'twitter:card': 'summary',
        },
      });

      [
        ['sku', 'AUTHORED-SKU'],
        ['type', 'authored-type'],
        ['twitter:card', 'summary'],
      ].forEach(([name, content]) => {
        const found = metasNamed(children, name);
        assert.strictEqual(found.length, 1, `exactly one ${name} meta`);
        assert.strictEqual(found[0].properties.content, content, `authored ${name} wins`);
      });
    });

    it('keeps the overridden tag at its generated position', async () => {
      const [, , description] = await renderHeadChildren({ metadata: { description: 'Authored' } });

      assert.strictEqual(description.properties.name, 'description');
      assert.strictEqual(description.properties.content, 'Authored');
    });

    it('does not let a metadata key clobber meta tags that use property instead of name', async () => {
      const children = await renderHeadChildren({ metadata: { undefined: 'x' } });

      const ogTitle = children.find((c) => c.properties?.property === 'og:title');
      assert.strictEqual(ogTitle.properties.content, 'Test Product');
      assert.strictEqual(metasNamed(children, 'undefined').length, 1, 'appended as its own meta');
    });
  });

  describe('description precedence', () => {
    const PB = { metaDescription: 'PB meta description', description: '<p>PB long description</p>' };

    it('prefers an explicitly authored description, inherited by og and twitter', async () => {
      const children = await renderHeadChildren(
        { ...PB, metadata: { description: 'Authored' } },
        { implicitDescription: 'Excerpt' },
      );

      assert.deepStrictEqual(descriptionTags(children), {
        description: ['Authored'], og: ['Authored'], twitter: ['Authored'],
      });
    });

    it('falls back to the Product Bus metaDescription', async () => {
      const children = await renderHeadChildren(PB, { implicitDescription: 'Excerpt' });

      assert.deepStrictEqual(descriptionTags(children), {
        description: ['PB meta description'], og: ['PB meta description'], twitter: ['PB meta description'],
      });
    });

    it('then falls back to the shortened Product Bus description', async () => {
      const children = await renderHeadChildren(
        { metaDescription: undefined, description: '<p>PB long description</p>' },
        { implicitDescription: 'Excerpt' },
      );

      assert.deepStrictEqual(descriptionTags(children).description, ['PB long description']);
    });

    it('uses the description generated from the authored page only as a last resort', async () => {
      const children = await renderHeadChildren(
        { metaDescription: undefined, description: undefined },
        { implicitDescription: 'Excerpt' },
      );

      assert.deepStrictEqual(descriptionTags(children), {
        description: ['Excerpt'], og: ['Excerpt'], twitter: ['Excerpt'],
      });
    });

    it('renders an empty description when nothing is available', async () => {
      const children = await renderHeadChildren({
        metaDescription: undefined,
        description: undefined,
      });

      assert.deepStrictEqual(descriptionTags(children).description, ['']);
    });

    it('ignores an empty explicit description', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { description: '' } });

      assert.deepStrictEqual(descriptionTags(children).description, ['PB meta description']);
    });

    it('lets an explicit og:description override og only, and twitter inherit it', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { 'og:description': 'Social copy' } });

      assert.deepStrictEqual(descriptionTags(children), {
        description: ['PB meta description'], og: ['Social copy'], twitter: ['Social copy'],
      });
    });

    it('lets an explicit twitter:description override twitter only', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { 'twitter:description': 'Tweet copy' } });

      assert.deepStrictEqual(descriptionTags(children), {
        description: ['PB meta description'], og: ['PB meta description'], twitter: ['Tweet copy'],
      });
    });

    it('does not render description metadata as additional meta tags', async () => {
      const children = await renderHeadChildren({
        ...PB,
        metadata: { Description: 'Authored', 'og:description': 'Social copy', 'twitter:description': 'Tweet copy' },
      });

      assert.strictEqual(metasNamed(children, 'og:description').length, 0, 'no <meta name="og:description">');
      assert.deepStrictEqual(descriptionTags(children), {
        description: ['Authored'], og: ['Social copy'], twitter: ['Tweet copy'],
      });
    });
  });

  describe('title precedence', () => {
    const PB = { metaTitle: 'PB meta title', name: 'PB name' };

    it('prefers an explicitly authored title, inherited by og and twitter', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { title: 'Authored' } });

      assert.deepStrictEqual(titleTags(children), {
        title: ['Authored'], og: ['Authored'], twitter: ['Authored'],
      });
    });

    it('falls back to the Product Bus metaTitle, then name', async () => {
      assert.deepStrictEqual(titleTags(await renderHeadChildren(PB)), {
        title: ['PB meta title'], og: ['PB meta title'], twitter: ['PB meta title'],
      });
      assert.deepStrictEqual(
        titleTags(await renderHeadChildren({ metaTitle: undefined, name: 'PB name' })).title,
        ['PB name'],
      );
    });

    it('ignores an empty explicit title', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { title: '' } });

      assert.deepStrictEqual(titleTags(children).title, ['PB meta title']);
    });

    it('lets an explicit og:title override og only, and twitter inherit it', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { 'og:title': 'Social title' } });

      assert.deepStrictEqual(titleTags(children), {
        title: ['PB meta title'], og: ['Social title'], twitter: ['Social title'],
      });
    });

    it('lets an explicit twitter:title override twitter only', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { 'twitter:title': 'Tweet title' } });

      assert.deepStrictEqual(titleTags(children), {
        title: ['PB meta title'], og: ['PB meta title'], twitter: ['Tweet title'],
      });
    });

    it('does not render title metadata as additional meta tags', async () => {
      const children = await renderHeadChildren({
        ...PB,
        metadata: { Title: 'Authored', 'og:title': 'Social title' },
      });

      assert.strictEqual(metasNamed(children, 'title').length, 0, 'no <meta name="title">');
      assert.strictEqual(metasNamed(children, 'og:title').length, 0, 'no <meta name="og:title">');
      assert.deepStrictEqual(titleTags(children), {
        title: ['Authored'], og: ['Social title'], twitter: ['Social title'],
      });
    });
  });

  describe('title and description together', () => {
    const PB = { metaTitle: 'PB title', metaDescription: 'PB description' };

    it('resolves an authored title without affecting the description', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { title: 'Authored title' } });

      assert.deepStrictEqual(titleTags(children), {
        title: ['Authored title'], og: ['Authored title'], twitter: ['Authored title'],
      });
      assert.deepStrictEqual(descriptionTags(children), {
        description: ['PB description'], og: ['PB description'], twitter: ['PB description'],
      });
    });

    it('resolves an authored description without affecting the title', async () => {
      const children = await renderHeadChildren({ ...PB, metadata: { description: 'Authored description' } });

      assert.deepStrictEqual(titleTags(children), {
        title: ['PB title'], og: ['PB title'], twitter: ['PB title'],
      });
      assert.deepStrictEqual(descriptionTags(children), {
        description: ['Authored description'],
        og: ['Authored description'],
        twitter: ['Authored description'],
      });
    });

    it('still renders the other metadata once each', async () => {
      const children = await renderHeadChildren({
        ...PB,
        metadata: {
          title: 'Authored title', description: 'Authored description', robots: 'noindex', keywords: 'blender',
        },
      });

      assert.deepStrictEqual(titleTags(children).title, ['Authored title']);
      assert.deepStrictEqual(descriptionTags(children).description, ['Authored description']);
      assert.deepStrictEqual(metasNamed(children, 'robots').map((m) => m.properties.content), ['noindex']);
      assert.deepStrictEqual(metasNamed(children, 'keywords').map((m) => m.properties.content), ['blender']);
      assert.strictEqual(metasNamed(children, 'title').length, 0);
    });
  });
});
