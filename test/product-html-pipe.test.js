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
import { PipelineRequest, PipelineState, PipelineStatusError } from '@adobe/helix-html-pipeline';
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
  it('returns 404 for invalid path info', async () => {
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = false;

    const result = await productHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'invalid path');
  });

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
      'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('renders a configurable product html from repoless site', async () => {
    const s3Loader = new FileS3Loader();
    const state = DEFAULT_STATE({
      ...DEFAULT_CONFIG,
      site: 'repoless-site',
    }, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });

    state.site = 'repoless-site';
    state.info = getPathInfo('/products/product-configurable');
    const resp = await productHTMLPipe(
      state,
      new PipelineRequest(
        new URL('https://acme.com/products/product-configurable'),
        {
          headers: {
            'x-byo-cdn-type': 'fastly',
          },
        },
      ),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="blitzmax-5000">BlitzMax 5000</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'surrogate-control': 'max-age=300, stale-while-revalidate=0',
      'surrogate-key': 'aVjSNe6DuUvP6Qt0 _H4KMAHPxerU_zHx E2NdXMQ8Jp-cg0zr mkywV26m8w1sg6tA main--repoless-site--org mRN24kMQcclw-dMQ',
    });
  });

  it('renders a configurable product html with CDN cache control headers', async () => {
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
      new PipelineRequest(new URL('https://acme.com/products/product-configurable'), {
        headers: {
          'x-byo-cdn-type': 'fastly',
        },
      }),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="blitzmax-5000">BlitzMax 5000</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'surrogate-control': 'max-age=300, stale-while-revalidate=0',
      'surrogate-key': 'VS5-46Z_DsIjIydC juOVlP_wU3xIZXph aa9iB4ZoKa28Ulqx gZ8sZQGPdZ1uFask main--site--org mRN24kMQcclw-dMQ',
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
      new PipelineRequest(new URL('https://acme.com/products/product-simple'), {
        headers: {
          'x-byo-cdn-type': 'cloudflare',
        },
      }),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="blitzmax-5000">BlitzMax 5000</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'cache-tag': 'VS5-46Z_DsIjIydC,juOVlP_wU3xIZXph,aa9iB4ZoKa28Ulqx,gZ8sZQGPdZ1uFask,main--site--org,XI4_5DVAssKv-Mlu',
      'cdn-cache-control': 'max-age=300, must-revalidate',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('handles a 404', async () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const fetchMockGlobal = fetchMock.mockGlobal();
    const html404 = await readFile(path.join(dirname, 'fixtures', 'product', '404.html'));
    fetchMockGlobal.get('https://main--site--adobe.aem.live/404.html', {
      body: html404,
      headers: {
        'cache-control': 'max-age=7200, must-revalidate',
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
      new PipelineRequest(new URL('https://acme.com/products/product-404.html'), {
        headers: {
          'x-byo-cdn-type': 'cloudflare',
        },
      }),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Wed, 30 Apr 2025 03:47:18 GMT',
      'cache-tag': 'VS5-46Z_DsIjIydC,juOVlP_wU3xIZXph,U4c6bN3DRwO8mnxl,3x-TYEuoLJlR0JRs,main--site--org,main--site--org_404',
      'cdn-cache-control': 'max-age=300, must-revalidate',
      'x-error': 'failed to load /products/product-404.json from product-bus: 404',
    });

    const resBody = resp.body;
    assert.strictEqual(resBody, html404.toString());
  });

  it('handles html generation exceptions during pipeline execution', async () => {
    // Mock the html step to throw an exception
    const { productHTMLPipe: mockedHTMLPipe } = await esmock('../src/index.js', {
      '../src/product-html-pipe.js': await esmock('../src/product-html-pipe.js', {
        '../src/steps/make-html.js': {
          default: () => {
            throw new Error('HTML generation failed');
          },
        },
      }),
    });

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

    const resp = await mockedHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable')),
    );

    // The response should have an error set due to the exception
    assert.strictEqual(resp.status, 500);
    assert.strictEqual(resp.headers.get('x-error'), 'HTML generation failed');
  });

  it('handles PipelineStatusError during pipeline execution', async () => {
    // Mock the html step to throw an exception
    const { productHTMLPipe: mockedHTMLPipe } = await esmock('../src/index.js', {
      '../src/product-html-pipe.js': await esmock('../src/product-html-pipe.js', {
        '../src/steps/stringify-response.js': {
          default: () => {
            throw new PipelineStatusError(500, 'no response document');
          },
        },
      }),
    });

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

    const resp = await mockedHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable')),
    );

    // The response should have an error set due to the exception
    assert.strictEqual(resp.status, 500);
    assert.strictEqual(resp.headers.get('x-error'), 'no response document');
  });

  it('reports a 502 during content fetch failure', async () => {
    // Mock the html step to throw an exception
    const { productHTMLPipe: mockedHTMLPipe } = await esmock('../src/index.js', {
      '../src/product-html-pipe.js': await esmock('../src/product-html-pipe.js', {
        '../src/steps/stringify-response.js': {
          default: () => {
            throw new PipelineStatusError(500, 'no response document');
          },
        },
      }),
    });

    const s3Loader = new FileS3Loader();
    s3Loader.status('product-configurable.json', 500);
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

    const resp = await mockedHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable')),
    );

    // The response should have an error set due to the exception
    assert.strictEqual(resp.status, 502);
  });
});
