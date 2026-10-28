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
import assert from 'assert';
import extractAuthoredMetadata from '../../src/steps/extract-authored-metadata.js';

/**
 * @param {number} count
 * @returns {string} `count` distinct words: "word1 word2 ..."
 */
function words(count) {
  return Array.from({ length: count }, (_, i) => `word${i + 1}`).join(' ');
}

/**
 * Builds a rendered aem.live page the way the HTML pipeline emits it: title and
 * description, with og:* inheriting from them and twitter:* inheriting from og:*.
 * @param {object} opts
 * @param {string} [opts.main] inner HTML of <main>
 * @param {string} [opts.title] <title> (omitted when undefined)
 * @param {string} [opts.ogTitle] og:title (defaults to title)
 * @param {string} [opts.twitterTitle] twitter:title (defaults to og:title)
 * @param {string} [opts.description] meta description (omitted when undefined)
 * @param {string} [opts.og] og:description (defaults to description)
 * @param {string} [opts.twitter] twitter:description (defaults to og:description)
 * @param {string} [opts.extraHead] additional head markup
 */
function page({
  main = '', title, ogTitle = title, twitterTitle = ogTitle,
  description, og = description, twitter = og, extraHead = '',
}) {
  const metas = [
    title !== undefined && `<title>${title}</title>`,
    ogTitle !== undefined && `<meta property="og:title" content="${ogTitle}">`,
    twitterTitle !== undefined && `<meta name="twitter:title" content="${twitterTitle}">`,
    description !== undefined && `<meta name="description" content="${description}">`,
    og !== undefined && `<meta property="og:description" content="${og}">`,
    twitter !== undefined && `<meta name="twitter:description" content="${twitter}">`,
  ].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html>
  <head>
    ${metas}
    ${extraHead}
  </head>
  <body>
    <header></header>
    <main>${main}</main>
    <footer></footer>
  </body>
</html>`;
}

/**
 * Runs the step against the given edge HTML and returns the resulting content.
 * @param {string} edge
 * @param {object} [data] product data already loaded from Product Bus
 */
async function run(edge, data = {}) {
  const state = { content: { edge, data } };
  // @ts-ignore minimal state
  await extractAuthoredMetadata(state);
  return state.content;
}

describe('extract-authored-metadata', () => {
  describe('description', () => {
    it('treats a description generated from a long body paragraph as implicit', async () => {
      const excerpt = `${words(25)} ...`;
      const content = await run(page({
        main: `<div><p>${words(30)}</p></div>`,
        description: excerpt,
      }));

      assert.strictEqual(content.implicitDescription, excerpt);
      assert.strictEqual(content.data.metadata, undefined, 'nothing treated as explicitly authored');
    });

    it('treats a description generated from a 10-25 word paragraph as implicit', async () => {
      const content = await run(page({
        main: `<div><p>${words(12)}</p></div>`,
        description: words(12),
      }));

      assert.strictEqual(content.implicitDescription, words(12));
      assert.strictEqual(content.data.metadata, undefined);
    });

    it('treats a description generated from a paragraph with a long word as implicit', async () => {
      const text = 'Supercalifragilisticexpialidocious blender';
      const content = await run(page({ main: `<div><p>${text}</p></div>`, description: text }));

      assert.strictEqual(content.implicitDescription, text);
      assert.strictEqual(content.data.metadata, undefined);
    });

    it('generates from the first qualifying div > p, including block cells', async () => {
      const content = await run(page({
        main: `<div>
          <p>Too short to qualify.</p>
          <p>See https://www.example.com/a-very-long-url-that-is-not-a-long-word</p>
          <div class="hero"><div><div><p>${words(11)}</p></div></div></div>
          <p>${words(20)}</p>
        </div>`,
        description: words(11),
      }));

      assert.strictEqual(content.implicitDescription, words(11));
      assert.strictEqual(content.data.metadata, undefined);
    });

    it('reads paragraph text like the HTML pipeline (inline elements kept, comments ignored)', async () => {
      const content = await run(page({
        main: `<div><p>Blend <span>hot</span> <span class="highlight">soups</span> <!-- note -->and ${words(8)}</p></div>`,
        description: `Blend hot soups and ${words(8)}`,
      }));

      assert.strictEqual(content.implicitDescription, `Blend hot soups and ${words(8)}`);
      assert.strictEqual(content.data.metadata, undefined);
    });

    it('treats a description that differs from the generated excerpt as explicitly authored', async () => {
      const content = await run(page({
        main: `<div><p>${words(30)}</p></div>`,
        description: 'Authored in the metadata block',
      }));

      assert.strictEqual(content.data.metadata?.description, 'Authored in the metadata block');
      assert.strictEqual(content.implicitDescription, undefined);
    });

    it('treats a description as explicitly authored when the body has nothing to generate from', async () => {
      const content = await run(page({ main: '<div><p>Short.</p></div>', description: 'Authored' }));

      assert.strictEqual(content.data.metadata?.description, 'Authored');
      assert.strictEqual(content.implicitDescription, undefined);
    });

    it('treats a description as explicitly authored when the page has no main content', async () => {
      const content = await run(page({ description: 'Authored' }));

      assert.strictEqual(content.data.metadata?.description, 'Authored');
    });

    it('ignores an empty description (e.g. a blank row in a page template)', async () => {
      const content = await run(page({ main: `<div><p>${words(30)}</p></div>`, description: '' }));

      assert.strictEqual(content.data.metadata, undefined);
      assert.strictEqual(content.implicitDescription, undefined);
    });
  });

  describe('og:description and twitter:description', () => {
    it('ignores them when they only inherit the description', async () => {
      const content = await run(page({ description: 'Authored' }));

      assert.deepStrictEqual(content.data.metadata, { description: 'Authored' });
    });

    it('keeps an og:description that was set explicitly', async () => {
      const content = await run(page({ description: 'Authored', og: 'Social copy' }));

      assert.deepStrictEqual(content.data.metadata, {
        description: 'Authored',
        'og:description': 'Social copy',
      });
    });

    it('keeps an explicit og:description even when the description is implicit', async () => {
      const content = await run(page({
        main: `<div><p>${words(12)}</p></div>`,
        description: words(12),
        og: 'Social copy',
      }));

      assert.deepStrictEqual(content.data.metadata, { 'og:description': 'Social copy' });
      assert.strictEqual(content.implicitDescription, words(12));
    });

    it('keeps a twitter:description that was set explicitly', async () => {
      const content = await run(page({ description: 'Authored', og: 'Social copy', twitter: 'Tweet copy' }));

      assert.deepStrictEqual(content.data.metadata, {
        description: 'Authored',
        'og:description': 'Social copy',
        'twitter:description': 'Tweet copy',
      });
    });

    it('still ignores the other og:* and twitter:* tags', async () => {
      const content = await run(page({
        description: 'Authored',
        extraHead: '<meta property="og:image" content="/i.png"><meta name="twitter:card" content="summary">',
      }));

      assert.deepStrictEqual(content.data.metadata, { description: 'Authored' });
    });
  });

  describe('title', () => {
    it('treats a title generated from the first h1 as implicit', async () => {
      const content = await run(page({
        main: '<div><h2>Intro</h2><p>Text</p></div><div><h1>BlitzMax 5000</h1></div>',
        title: 'BlitzMax 5000',
      }));

      assert.strictEqual(content.data.metadata, undefined);
    });

    it('treats a title generated from the first heading of any level as implicit', async () => {
      const content = await run(page({
        main: '<div><h2>Features</h2><p>Text</p><h3>In the box</h3></div>',
        title: 'Features',
      }));

      assert.strictEqual(content.data.metadata, undefined);
    });

    it('treats a generated title with a bulk metadata suffix as implicit', async () => {
      const content = await run(page({
        main: '<div><h2>Features</h2></div>',
        title: 'Features | Blendify',
      }));

      assert.strictEqual(content.data.metadata, undefined);
    });

    it('treats a title that differs from the generated one as explicitly authored', async () => {
      const content = await run(page({
        main: '<div><h2>Features</h2></div>',
        title: 'BlitzMax 5000 Blender',
      }));

      assert.deepStrictEqual(content.data.metadata, { title: 'BlitzMax 5000 Blender' });
    });

    it('treats a title as explicitly authored when the page has no headings', async () => {
      const content = await run(page({ main: '<div><p>Text</p></div>', title: 'Authored' }));

      assert.deepStrictEqual(content.data.metadata, { title: 'Authored' });
    });

    it('ignores an empty title', async () => {
      const content = await run(page({ main: '<div><p>Text</p></div>', title: '' }));

      assert.strictEqual(content.data.metadata, undefined);
    });

    it('keeps an og:title that was set explicitly', async () => {
      const content = await run(page({
        main: '<div><h2>Features</h2></div>',
        title: 'Features',
        ogTitle: 'Social title',
      }));

      assert.deepStrictEqual(content.data.metadata, { 'og:title': 'Social title' });
    });

    it('ignores an og:title that only lacks the <title> suffix', async () => {
      const content = await run(page({
        main: '<div><h2>Features</h2></div>',
        title: 'Features | Shop',
        ogTitle: 'Features',
      }));

      assert.strictEqual(content.data.metadata, undefined);
    });

    it('keeps a twitter:title that was set explicitly', async () => {
      const content = await run(page({
        main: '<div><h2>Features</h2></div>',
        title: 'Features',
        twitterTitle: 'Tweet title',
      }));

      assert.deepStrictEqual(content.data.metadata, { 'twitter:title': 'Tweet title' });
    });

    it('reads headings with inline formatting', async () => {
      const content = await run(page({
        main: '<div><h3><strong>Product Specifications</strong></h3></div>',
        title: 'Product Specifications',
      }));

      assert.strictEqual(content.data.metadata, undefined);
    });
  });

  describe('generated description rules', () => {
    it('skips paragraphs under 10 words and uses the first with exactly 10', async () => {
      const content = await run(page({
        main: `<div><p>${words(9)}</p><p>${words(10)}</p></div>`,
        description: words(10),
      }));

      assert.strictEqual(content.implicitDescription, words(10));
      assert.strictEqual(content.data.metadata, undefined);
    });

    it('does not add an ellipsis to a paragraph of exactly 25 words', async () => {
      const content = await run(page({
        main: `<div><p>${words(25)}</p></div>`,
        description: words(25),
      }));

      assert.strictEqual(content.implicitDescription, words(25));
      assert.strictEqual(content.data.metadata, undefined);
    });

    it('decodes HTML entities in both the head and the body', async () => {
      // aem.live encodes `&` as `&#x26;` in the head and `&amp;` in the body
      const content = await run(page({
        main: `<div>
          <h2>Soups &amp; Smoothies</h2>
          <p>Preset programs for soups &amp; smoothies, frozen desserts, and nut butters adjust speed and time automatically.</p>
        </div>`,
        title: 'Soups &#x26; Smoothies',
        description: 'Preset programs for soups &#x26; smoothies, frozen desserts, and nut butters adjust speed and time automatically.',
      }));

      assert.strictEqual(
        content.implicitDescription,
        'Preset programs for soups & smoothies, frozen desserts, and nut butters adjust speed and time automatically.',
      );
      assert.strictEqual(content.data.metadata, undefined, 'title and description both generated');
    });
  });

  describe('whole pages', () => {
    const PARAGRAPH = 'The BlitzMax travel cup keeps hot and cold drinks at the right temperature on the go, and pairs with any BlitzMax blade base for quick single-serve blending at home or at work.';
    const EXCERPT = 'The BlitzMax travel cup keeps hot and cold drinks at the right temperature on the go, and pairs with any BlitzMax blade base for quick ...';

    it('keeps only page settings from a typical aem.live product page', async () => {
      // typical aem.live product page: no metadata block, settings from bulk metadata
      const content = await run(page({
        main: `<div><h2>Features</h2><p>${PARAGRAPH}</p></div>`,
        title: 'Features',
        description: EXCERPT,
        extraHead: `
          <meta property="og:url" content="https://main--site--org.aem.live/products/blitzmax-travel-cup">
          <meta property="og:image" content="https://main--site--org.aem.live/default-meta-image.png">
          <meta name="twitter:card" content="summary_large_image">
          <meta name="nav" content="/nav">
          <meta name="footer" content="/footer">
          <meta name="template" content="product">
          <meta name="robots" content="index, follow">
          <meta name="viewport" content="width=device-width, initial-scale=1">`,
      }));

      assert.deepStrictEqual(content.data.metadata, {
        nav: '/nav',
        footer: '/footer',
        template: 'product',
        robots: 'index, follow',
      });
      assert.strictEqual(content.implicitDescription, EXCERPT);
    });

    it('keeps an authored title while the description is generated', async () => {
      const content = await run(page({
        main: `<div><h2>Features</h2><p>${PARAGRAPH}</p></div>`,
        title: 'BlitzMax 5000 Blender',
        description: EXCERPT,
      }));

      assert.deepStrictEqual(content.data.metadata, { title: 'BlitzMax 5000 Blender' });
      assert.strictEqual(content.implicitDescription, EXCERPT);
    });

    it('keeps an authored description while the title is generated', async () => {
      const content = await run(page({
        main: `<div><h2>Features</h2><p>${PARAGRAPH}</p></div>`,
        title: 'Features',
        description: 'Authored description',
      }));

      assert.deepStrictEqual(content.data.metadata, { description: 'Authored description' });
      assert.strictEqual(content.implicitDescription, undefined);
    });

    it('keeps both when the metadata block sets title and description', async () => {
      const content = await run(page({
        main: `<div><h1>Congrats, you are ready to go!</h1><p>${PARAGRAPH}</p></div>`,
        title: 'Home | AEM Boilerplate',
        description: 'Use this template repository as the starting point for new AEM projects.',
      }));

      assert.deepStrictEqual(content.data.metadata, {
        title: 'Home | AEM Boilerplate',
        description: 'Use this template repository as the starting point for new AEM projects.',
      });
    });
  });

  describe('merging with Product Bus metadata', () => {
    it('lets authored values win and keeps the other Product Bus metadata', async () => {
      const content = await run(
        page({
          main: '<div><p>Short.</p></div>',
          description: 'Authored description',
          extraHead: '<meta name="robots" content="noindex">',
        }),
        { metadata: { description: 'PB metadata description', robots: 'index', 'custom-key': 'kept' } },
      );

      assert.deepStrictEqual(content.data.metadata, {
        description: 'Authored description',
        robots: 'noindex',
        'custom-key': 'kept',
      });
    });

    it('leaves Product Bus metadata untouched when the page values are generated', async () => {
      const content = await run(
        page({
          main: `<div><h2>Features</h2><p>${words(30)}</p></div>`,
          title: 'Features',
          description: `${words(25)} ...`,
        }),
        { metadata: { title: 'PB metadata title', description: 'PB metadata description' } },
      );

      assert.deepStrictEqual(content.data.metadata, {
        title: 'PB metadata title',
        description: 'PB metadata description',
      });
    });

    it('does nothing when there is no authored page', async () => {
      const state = { content: { data: { metadata: { robots: 'index' } } } };
      // @ts-ignore minimal state
      await extractAuthoredMetadata(state);

      assert.deepStrictEqual(state.content.data, { metadata: { robots: 'index' } });
      assert.strictEqual(state.content.implicitDescription, undefined);
      assert.strictEqual(state.content.edgeHast, undefined);
    });
  });
});
