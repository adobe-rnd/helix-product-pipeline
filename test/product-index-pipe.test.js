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
import { readFile } from 'fs/promises';
import { PipelineRequest, PipelineState } from '@adobe/helix-html-pipeline';
import { FileS3Loader } from './FileS3Loader.js';
import { productIndexPipe } from '../src/index.js';
import { toSpreadsheet } from '../src/product-index-pipe.js';
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
      '/products/{{urlKey}}': {
        pageType: 'product',
      },
    },
  },
};

const DEFAULT_STATE = (opts = {}) => (new PipelineState({
  config: DEFAULT_CONFIG,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'live',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('Product Index Pipe Test', () => {
  it('renders an index json in spreadsheet format (with urlKey based path)', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      index: 200,
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');
    const resp = await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );
    assert.strictEqual(resp.status, 200);

    const spreadsheetIndexFixture = JSON.parse(
      await readFile(new URL('./fixtures/index/spreadsheet.json', import.meta.url), 'utf-8'),
    );
    const body = JSON.parse(resp.body);
    assert.deepStrictEqual(body, spreadsheetIndexFixture);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      // 'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/json',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('renders an index json in spreadsheet format (with sku based path)', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      index: 200,
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
      config: {
        ...DEFAULT_CONFIG,
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
      },
    });
    state.info = getPathInfo('/products/index.json');
    const resp = await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );
    assert.strictEqual(resp.status, 200);

    const spreadsheetIndexFixture = JSON.parse(
      await readFile(new URL('./fixtures/index/spreadsheet.json', import.meta.url), 'utf-8'),
    );
    const body = JSON.parse(resp.body);
    assert.deepStrictEqual(body, spreadsheetIndexFixture);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('sends 400 for non json path', async () => {
    const state = DEFAULT_STATE({
      path: '/blog/index',
    });
    const result = await productIndexPipe(state, new PipelineRequest('https://acme.com/products/'));
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'only json resources supported.');
  });

  it('handles a 404', async () => {
    const state = DEFAULT_STATE({
      path: '/products/index.json',
    });
    state.info = getPathInfo('/products/index.json');

    const result = await productIndexPipe(state, new PipelineRequest(new URL('https://acme.com/products/index.json?id=404')));
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'failed to load adobe/helix-pages/main/default/index/404.json from product-bus: 404');
  });

  it('returns 404 for invalid path info', async () => {
    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = false;

    const result = await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'invalid path');
  });

  it('sets state type to index', async () => {
    const s3Loader = new FileS3Loader();

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');
    await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );
    assert.strictEqual(state.type, 'index');
  });

  it('returns early when res.error is set but res.status is less than 400', async () => {
    // Mock fetchContent to set res.error and res.status < 400
    const { productIndexPipe: pipe } = await esmock('../src/product-index-pipe.js', {
      '../src/steps/fetch-content.js': {
        default: async (state, req, res) => {
          res.error = 'Some non-critical error';
          res.status = 200; // Status less than 400
        },
      },
    });

    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');

    const result = await pipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );

    // Should return early without throwing PipelineStatusError
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.error, 'Some non-critical error');
    // Should not have gone through the full pipeline (no JSON body, no cache headers)
    assert.strictEqual(result.body, '');
  });

  describe('toSpreadsheet', () => {
    it('returns a spreadsheet', () => {
      const spreadsheet = toSpreadsheet({
        vbndax5ks: {
          urlKey: 'ascent-x5-smartprep-kitchen-system',
          title: 'Ascent® X5 SmartPrep™ Kitchen System',
          price: '949.95',
          image: './media_20b43ff4abb1e54666eb0fa736b1343ac894a794.jpg',
          description: '',
          series: 'Ascent X Series',
          variants: {
            '073495-04-VB': {
              title: 'Ascent X5-Brushed Stainless Metal Finish',
              price: '949.95',
              image: './media_a7274c9d79252baba87664333cf9400a9e9e7035.jpg',
            },
            '074104-04-VB': {
              title: 'Ascent X5-Graphite Metal Finish',
              price: '949.95',
              image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
            },
          },
          colors: 'Brushed Stainless Metal Finish,Black',
        },
        'x2-kitchen-system': {
          urlKey: 'ascent-x2-smartprep-kitchen-system',
          title: 'Ascent® X2 SmartPrep Kitchen System',
          price: '749.95',
          colors: 'Shadow Black',
          image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
          description: '',
          series: 'Ascent X Series',
          variants: {
            '075710-100': {
              title: 'Ascent® X2 SmartPrep Kitchen System-Shadow Black',
              price: '749.95',
              image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
            },
          },
        },
        'ascent-x5': {
          urlKey: 'ascent-x5',
          title: 'Ascent® X5',
          price: '749.95',
          colors: 'Brushed Stainless Metal Finish,Graphite Metal Finish',
          image: './media_7bacc89abbcd1d51e8395fd123cdd3c5d5a3d057.png',
          description: '',
          series: 'Ascent X Series',
          variants: {
            '073495-04': {
              title: 'Ascent X5-Brushed Stainless Metal Finish',
              price: '749.95',
              image: './media_caee0cae83d8cb8fba9d445b91c91574c4a05e34.jpg',
            },
            '074104-04': {
              title: 'Ascent® X5-Graphite Metal Finish',
              price: '749.95',
              image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
            },
          },
        },
      });
      assert.deepStrictEqual(spreadsheet, {
        ':type': 'sheet',
        columns: [
          'sku',
          'urlKey',
          'title',
          'price',
          'image',
          'description',
          'series',
          'colors',
          'parentSku',
          'variantSkus',
        ],
        data: [
          {
            sku: 'vbndax5ks',
            urlKey: 'ascent-x5-smartprep-kitchen-system',
            title: 'Ascent® X5 SmartPrep™ Kitchen System',
            price: '949.95',
            image: './media_20b43ff4abb1e54666eb0fa736b1343ac894a794.jpg',
            description: '',
            series: 'Ascent X Series',
            variants: undefined,
            colors: 'Brushed Stainless Metal Finish,Black',
            variantSkus: '073495-04-VB,074104-04-VB',
          },
          {
            parentSku: 'vbndax5ks',
            sku: '073495-04-VB',
            title: 'Ascent X5-Brushed Stainless Metal Finish',
            price: '949.95',
            image: './media_a7274c9d79252baba87664333cf9400a9e9e7035.jpg',
          },
          {
            parentSku: 'vbndax5ks',
            sku: '074104-04-VB',
            title: 'Ascent X5-Graphite Metal Finish',
            price: '949.95',
            image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
          },
          {
            sku: 'x2-kitchen-system',
            urlKey: 'ascent-x2-smartprep-kitchen-system',
            title: 'Ascent® X2 SmartPrep Kitchen System',
            price: '749.95',
            colors: 'Shadow Black',
            image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
            description: '',
            series: 'Ascent X Series',
            variants: undefined,
            variantSkus: '075710-100',
          },
          {
            parentSku: 'x2-kitchen-system',
            sku: '075710-100',
            title: 'Ascent® X2 SmartPrep Kitchen System-Shadow Black',
            price: '749.95',
            image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
          },
          {
            sku: 'ascent-x5',
            urlKey: 'ascent-x5',
            title: 'Ascent® X5',
            price: '749.95',
            colors: 'Brushed Stainless Metal Finish,Graphite Metal Finish',
            image: './media_7bacc89abbcd1d51e8395fd123cdd3c5d5a3d057.png',
            description: '',
            series: 'Ascent X Series',
            variants: undefined,
            variantSkus: '073495-04,074104-04',
          },
          {
            parentSku: 'ascent-x5',
            sku: '073495-04',
            title: 'Ascent X5-Brushed Stainless Metal Finish',
            price: '749.95',
            image: './media_caee0cae83d8cb8fba9d445b91c91574c4a05e34.jpg',
          },
          {
            parentSku: 'ascent-x5',
            sku: '074104-04',
            title: 'Ascent® X5-Graphite Metal Finish',
            price: '749.95',
            image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
          },
        ],
      });
    });
  });
});
