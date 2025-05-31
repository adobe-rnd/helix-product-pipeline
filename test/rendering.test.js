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
    '../src/steps/render.js': await esmock('../src/steps/render.js'),
    // '../src/steps/fetch-404.js': await esmock('../src/steps/fetch-404.js'),
  }),
});

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
  cdn: {
    prod: {
      host: 'www.adobe.com',
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
      '/{{sku}}': {
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
      url = new URL(`https://helix-pages.com/${url}`);
    }
    const expFile = path.resolve(__testdir, 'fixtures', 'product', `${url.pathname.substring(1)}.html`);
    let expHtml = null;
    try {
      expHtml = await readFile(expFile, 'utf-8');
    } catch {
      // ignore
    }
    // console.log(expHtml);
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
    it('renders product-1 correctly', async () => {
      await testRender('product-1', 'html', 200);
    });

    it('renders product-simple correctly', async () => {
      await testRender('product-simple', 'html', 200);
    });
  });
});
