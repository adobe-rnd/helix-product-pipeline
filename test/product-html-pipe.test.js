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
      '/{{sku}}': {
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
  it('renders a product html', async () => {
    const s3Loader = new FileS3Loader();
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/product-1',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/product-1');
    const resp = await productHTMLPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-1')),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="blitzmax-5000">BlitzMax 5000</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });
});
