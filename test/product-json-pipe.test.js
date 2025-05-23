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
import { productJSONPipe } from '../src/index.js';
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

const DEFAULT_STATE = (opts = {}) => (new PipelineState({
  config: DEFAULT_CONFIG,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'preview',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('Product JSON Pipe Test', () => {
  it('renders a product json', async () => {
    const s3Loader = new FileS3Loader();
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/product-1.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/product-1.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/')),
    );
    assert.strictEqual(resp.status, 200);

    const body = JSON.parse(resp.body);
    assert.strictEqual(body.name, 'BlitzMax 5000');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('sends 400 for non json path', async () => {
    const state = DEFAULT_STATE({
      path: '/blog/article',
    });
    const result = await productJSONPipe(state, new PipelineRequest('https://acme.com/products/'));
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'only json resources supported.');
  });
});
