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
/* eslint-env mocha */
import assert from 'assert';
import esmock from 'esmock';
import path from 'path';
import { PipelineRequest, PipelineState } from '@adobe/helix-html-pipeline';
import { readFile } from 'fs/promises';
import { JSDOM } from 'jsdom';
import { assertHTMLEquals } from './utils.js';
import { FileS3Loader } from './FileS3Loader.js';
import { getPathInfo } from '../src/utils/path.js';

const { productHTMLPipe } = await esmock('../src/index.js', {
  '../src/product-html-pipe.js': await esmock('../src/product-html-pipe.js', {
    '../src/steps/render-body.js': await esmock('../src/steps/render-body.js'),
    // '../src/steps/fetch-404.js': await esmock('../src/steps/fetch-404.js'),
  }),
});

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'blendify',
  repo: 'website',
  ref: 'main',
  cdn: {
    prod: {
      host: 'www.blendify.com',
    },
  },
  head: {
    html: '<link id="favicon" rel="icon" type="image/svg+xml" href="/icons/spark.svg">\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<script src="/scripts.js" type="module"></script>\n<link rel="stylesheet" href="/styles.css"/>\n',
  },
  public: {
    patterns: {
      base: {
        storeViewCode: 'default',
        storeCode: 'main',
      },
      '/us/en_us/products/{{sku}}': {
        pageType: 'product',
      },
    },
  },
};

describe('Rendering', () => {
  let loader;
  let config;

  beforeEach(() => {
    loader = new FileS3Loader();
    config = DEFAULT_CONFIG;
  });

  async function render(url, selector = '', expectedStatus = 200, partition = 'live') {
    const req = new PipelineRequest(url, {
      headers: new Map([['host', url.hostname]]),
      body: '',
    });

    const state = new PipelineState({
      log: console,
      s3Loader: loader,
      org: 'adobe',
      site: 'helix-pages',
      ref: 'super-test',
      partition,
      config,
      path: selector ? `${url.pathname}${selector}.html` : url.pathname,
      timer: {
        update: () => { },
      },
    });

    state.info = getPathInfo(url.pathname);
    const res = await productHTMLPipe(state, req);
    assert.strictEqual(res.status, expectedStatus);
    return res;
  }

  // eslint-disable-next-line default-param-last
  async function testRender(url, domSelector = 'main', expStatus, partition = 'live') {
    if (!(url instanceof URL)) {
      // eslint-disable-next-line no-param-reassign
      url = new URL(`https://www.blendify.com/us/en_us/products/${url}`);
    }

    const fileName = url.pathname.split('/').pop();
    const expFile = path.resolve(__testdir, 'fixtures', 'product', `${fileName}.html`);
    let expHtml = null;
    try {
      expHtml = await readFile(expFile, 'utf-8');
    } catch {
      // ignore
    }
    if (!expStatus) {
      // eslint-disable-next-line no-param-reassign
      expStatus = expHtml === null ? 404 : 200;
    }
    const response = await render(url, '', expStatus, partition);
    const actHtml = response.body;
    // console.log(actHtml);
    if (expStatus === 200) {
      const $actMain = new JSDOM(actHtml).window.document.querySelector(domSelector);
      const $expMain = new JSDOM(expHtml).window.document.querySelector(domSelector);
      await assertHTMLEquals($actMain.outerHTML, $expMain.outerHTML);
    }
    return response;
  }

  describe('Product', () => {
    it('renders product-configurable correctly', async () => {
      await testRender('product-configurable', 'html', 200);
    });

    it('renders product-simple correctly', async () => {
      await testRender('product-simple', 'html', 200);
    });

    it('renders product-bundle correctly', async () => {
      await testRender('product-bundle', 'html', 200);
    });

    it('renders no html description in p tag', async () => {
      await testRender('no-html-description', 'html', 200);
    });

    it('strips html description when no meta description is present', async () => {
      await testRender('no-metadescription-with-html-description', 'html', 200);
    });

    it('renders custom metadata', async () => {
      await testRender('custom-metadata', 'html', 200);
    });

    it('renders no images', async () => {
      await testRender('no-images', 'html', 200);
    });

    it('renders image props correctly', async () => {
      await testRender('image-props', 'html', 200);
    });

    it('renders no meta title', async () => {
      await testRender('no-meta-title', 'html', 200);
    });

    it('renders no price', async () => {
      await testRender('no-price', 'html', 200);
    });

    it('renders no variants', async () => {
      await testRender('variants-no-options', 'html', 200);
    });

    it('renders no specifications, no name', async () => {
      await testRender('no-specifications-no-name', 'html', 200);
    });

    it('renders no option uid', async () => {
      await testRender('no-option-uid', 'html', 200);
    });

    it('renders no name, no meta title', async () => {
      await testRender('no-name-no-metatitle', 'html', 200);
    });

    it('renders no meta description, no description', async () => {
      await testRender('no-metadescription-no-description', 'html', 200);
    });

    it('renders non-mediabus images as absolute urls with query params', async () => {
      await testRender('non-mediabus-images', 'html', 200);
    });
  });
});
