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
 * Builds a rendered aem.live page the way the HTML pipeline emits it:
 * description, then og:description and twitter:description inheriting from it.
 * @param {object} opts
 * @param {string} [opts.main] inner HTML of <main>
 * @param {string} [opts.description] meta description (omitted when undefined)
 * @param {string} [opts.og] og:description (defaults to description)
 * @param {string} [opts.twitter] twitter:description (defaults to og:description)
 * @param {string} [opts.extraHead] additional head markup
 */
function page({
  main = '', description, og = description, twitter = og, extraHead = '',
}) {
  const metas = [
    description !== undefined && `<meta name="description" content="${description}">`,
    og !== undefined && `<meta property="og:description" content="${og}">`,
    twitter !== undefined && `<meta name="twitter:description" content="${twitter}">`,
  ].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
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
 */
async function run(edge) {
  const state = { content: { edge, data: {} } };
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

    it('restores icons, which the HTML pipeline renders after generating the description', async () => {
      const content = await run(page({
        main: `<div><p>Add to <span class="icon icon-cart"></span> today and save on ${words(8)}</p></div>`,
        description: `Add to :cart: today and save on ${words(8)}`,
      }));

      assert.strictEqual(content.implicitDescription, `Add to :cart: today and save on ${words(8)}`);
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
        extraHead: '<meta property="og:title" content="T"><meta name="twitter:title" content="T">',
      }));

      assert.deepStrictEqual(content.data.metadata, { description: 'Authored' });
    });
  });
});
