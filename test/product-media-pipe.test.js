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
import { productMediaPipe } from '../src/index.js';
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

describe('Product Media Pipe Test', () => {
  it('returns a product image', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.headers('media_11fa1411c77cbc54df349acdf818c84519d82750.png', 'content-type', 'image/png');
    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      log: console,
      s3Loader,
      ref: 'main',
      path: '/media_11fa1411c77cbc54df349acdf818c84519d82750.png',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/media_11fa1411c77cbc54df349acdf818c84519d82750.png');
    const resp = await productMediaPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/')),
    );
    assert.strictEqual(resp.status, 200);

    // Check that it's a png
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'image/png',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-amz-meta-x-source-location': 'media_11fa1411c77cbc54df349acdf818c84519d82750.png',
      'x-source-location': 'media_11fa1411c77cbc54df349acdf818c84519d82750.png',
    });
  });
});
