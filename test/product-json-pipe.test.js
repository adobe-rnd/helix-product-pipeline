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
import { PipelineRequest, PipelineState } from '@adobe/helix-html-pipeline';
import { FileS3Loader } from './FileS3Loader.js';
import { productJSONPipe } from '../src/index.js';
import { getPathInfo } from '../src/utils/path.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
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

describe('Product JSON Pipe Test', () => {
  it('renders a product json', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };

    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(resp.status, 200);

    const body = JSON.parse(resp.body);
    assert.strictEqual(body.name, 'BlitzMax 5000');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/json',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('renders a product json with CDN cache control headers', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };

    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json'), {
        headers: {
          'x-byo-cdn-type': 'cloudflare',
        },
      }),
    );
    assert.strictEqual(resp.status, 200);

    const body = JSON.parse(resp.body);
    assert.strictEqual(body.name, 'BlitzMax 5000');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/json',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'cache-tag': 'UI-O1qYltIMee0dw,main--site--org,3nfMHLtnsFZ5Q_2g',
      'cdn-cache-control': 'max-age=300, must-revalidate',
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

  it('handles a 404', async () => {
    const state = DEFAULT_STATE({
      path: '/products/product-404.json',
    });
    const result = await productJSONPipe(state, new PipelineRequest(new URL('https://acme.com/products/product-404.json')));
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'failed to load org/site/catalog/products/product-404.json from product-bus: 404');
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

    const result = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'invalid path');
  });

  it('sets state type to json', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(state.type, 'json');
  });

  it('returns early when res.error is set but res.status is less than 400', async () => {
    // Mock fetchContent to set res.error and res.status < 400
    const { productJSONPipe: pipe } = await esmock('../src/product-json-pipe.js', {
      '../src/steps/fetch-productbus.js': {
        default: async (state, req, res) => {
          res.error = 'Some non-critical error';
          res.status = 200; // Status less than 400
        },
      },
    });

    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');

    const result = await pipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );

    // Should return early without throwing PipelineStatusError
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.error, 'Some non-critical error');
    // Should not have gone through the full pipeline (no JSON body, no cache headers)
    assert.strictEqual(result.body, '');
  });

  it('handles state without timer correctly', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      // No timer property
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(resp.status, 200);
  });

  it('handles state with timer but no update method correctly', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {}, // Timer without update method
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(resp.status, 500);
    assert.strictEqual(resp.headers.get('x-error'), 'state.timer?.update is not a function');
  });

  it('handles different CDN types correctly', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');

    // Test Fastly CDN
    const fastlyResp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json'), {
        headers: {
          'x-byo-cdn-type': 'fastly',
        },
      }),
    );
    assert.strictEqual(fastlyResp.status, 200);
    assert(fastlyResp.headers.get('surrogate-key'), 'Should have surrogate-key for Fastly');

    // Test Akamai CDN
    const akamaiResp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json'), {
        headers: {
          'x-byo-cdn-type': 'akamai',
        },
      }),
    );
    assert.strictEqual(akamaiResp.status, 200);
    assert(akamaiResp.headers.get('edge-cache-tag'), 'Should have edge-cache-tag for Akamai');

    // Test CloudFront CDN
    const cloudfrontResp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json'), {
        headers: {
          'x-byo-cdn-type': 'cloudfront',
        },
      }),
    );
    assert.strictEqual(cloudfrontResp.status, 200);
    assert(cloudfrontResp.headers.get('cache-control').includes('s-maxage'), 'Should have s-maxage for CloudFront');
  });

  it('handles push invalidation enabled', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json'), {
        headers: {
          'x-byo-cdn-type': 'cloudflare',
          'x-push-invalidation': 'enabled',
        },
      }),
    );
    assert.strictEqual(resp.status, 200);
    // Should have longer CDN TTL when push invalidation is enabled
    assert(resp.headers.get('cdn-cache-control').includes('max-age=172800'), 'Should have longer CDN TTL');
  });

  it('handles unknown CDN type', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.statusCodeOverrides = {
      'product-configurable': 200,
    };
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const resp = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json'), {
        headers: {
          'x-byo-cdn-type': 'unknown-cdn',
        },
      }),
    );
    assert.strictEqual(resp.status, 200);
    // Should not have CDN-specific headers for unknown CDN type
    assert(!resp.headers.get('surrogate-key'), 'Should not have surrogate-key for unknown CDN');
    assert(!resp.headers.get('edge-cache-tag'), 'Should not have edge-cache-tag for unknown CDN');
    assert(!resp.headers.get('cache-tag'), 'Should not have cache-tag for unknown CDN');
  });

  it('handles server error from fetchContent', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.status('product-configurable.json', 500);
    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const result = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 502);
    assert.strictEqual(result.headers.get('x-error'), 'failed to load org/site/catalog/products/product-configurable.json from product-bus: 500');
  });

  it('handles json parsing error', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.status('product-configurable', 200);
    s3Loader.override('product-configurable', 'invalid json');
    s3Loader.headers('product-configurable', 'sku', 'product-configurable');
    s3Loader.status('product-configurable.json', 200);
    s3Loader.override('product-configurable.json', 'invalid json');
    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const result = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'failed to parse org/site/catalog/products/product-configurable.json from product-bus: Unexpected token \'i\', "invalid json" is not valid JSON');
  });

  it('handles error during initConfig', async () => {
    const s3Loader = new FileS3Loader();
    // Mock s3Loader to throw an error during initConfig
    s3Loader.getObject = async () => {
      throw new Error('S3 connection failed');
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');
    const result = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 500);
    assert.strictEqual(result.headers.get('x-error'), 'S3 connection failed');
  });

  it('handles 404 error with surrogate keys', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.status('product-configurable.json', 404);
    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');

    const result = await productJSONPipe(
      state,
      new PipelineRequest(
        new URL('https://acme.com/products/product-configurable.json'),
        {
          headers: {
            'x-byo-cdn-type': 'cloudflare',
          },
        },
      ),
    );
    assert.strictEqual(result.status, 404);
    assert.deepStrictEqual(Object.fromEntries(result.headers.entries()), {
      'cache-control': 'max-age=7200, must-revalidate',
      'x-error': 'failed to load org/site/catalog/products/product-configurable.json from product-bus: 404',
      'cache-tag': 'main--site--org_404',
      'cdn-cache-control': 'max-age=300, must-revalidate',
    });
  });

  it('handles generic error with 500 status', async () => {
    const s3Loader = new FileS3Loader();
    // Mock s3Loader to throw a generic error
    s3Loader.getObject = async () => {
      throw new TypeError('Type error occurred');
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');

    const result = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 500);
    assert.strictEqual(result.headers.get('x-error'), 'Type error occurred');
  });

  it('handles error with special characters in message', async () => {
    const s3Loader = new FileS3Loader();
    // Mock s3Loader to throw an error with special characters
    s3Loader.getObject = async () => {
      throw new Error('Error with "quotes" and \n newlines');
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/product-configurable.json');

    const result = await productJSONPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 500);
    // The error message should be cleaned by cleanupHeaderValue
    assert(result.headers.get('x-error'), 'Should have cleaned error message');
  });
});
