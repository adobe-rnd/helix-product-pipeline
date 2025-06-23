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
import { PipelineRequest, PipelineState } from '@adobe/helix-html-pipeline';
import fetchMock from 'fetch-mock';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { FileS3Loader } from './FileS3Loader.js';
import { productHTMLPipe } from '../src/index.js';
import { getPathInfo } from '../src/utils/path.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
  public: {
    patterns: {
      base: {
        storeViewCode: 'default',
        storeCode: 'main',
      },
      '/products/{{sku}}': {
        pageType: 'product',
      },
    },
  },
};

const DEFAULT_STATE = (config = DEFAULT_CONFIG, opts = {}) => (new PipelineState({
  config,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'preview',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('Product HTML Pipe Test', () => {
  it('renders a configurable product html', async () => {
    const s3Loader = new FileS3Loader();
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable');
    const resp = await productHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable')),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="blitzmax-5000">BlitzMax 5000</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'mRN24kMQcclw-dMQ foo-id_metadata main--helix-pages--adobe_head foo-id',
    });
  });

  it('renders a simple product html', async () => {
    const s3Loader = new FileS3Loader();
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-simple',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-simple');
    const resp = await productHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-simple')),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="blitzmax-5000">BlitzMax 5000</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'XI4_5DVAssKv-Mlu foo-id_metadata main--helix-pages--adobe_head foo-id',
    });
  });

  it('handles a 404', async () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const fetchMockGlobal = fetchMock.mockGlobal();
    fetchMockGlobal.get('https://main--helix-pages--adobe.aem.live/404.html', {
      body: await readFile(path.join(dirname, 'fixtures', 'product', '404.html')),
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Last-Modified': 'Fri, 30 Apr 2025 03:47:18 GMT',
      },
    });
    const s3Loader = new FileS3Loader();
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-404',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-404');
    const resp = await productHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-404.html')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Wed, 30 Apr 2025 03:47:18 GMT',
      'x-error': 'failed to load /products/product-404.json from product-bus: 404',
      'x-surrogate-key': 'uOhB41fFzP0Al-SD foo-id P0oVzuYmPy9MmiYp main--helix-pages--adobe_404 main--helix-pages--adobe_code',
    });
  });
});
