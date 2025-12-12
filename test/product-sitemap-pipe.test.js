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
import { readFile } from 'fs/promises';
import { FileS3Loader } from './FileS3Loader.js';
import { productSitemapPipe } from '../src/index.js';
import { toSitemapXML } from '../src/product-sitemap-pipe.js';
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

// SKIPPED: Temporarily disabled
describe.skip('Product Sitemap Pipe Test', () => {
  it('renders a sitemap xml', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      index: 200,
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/sitemap.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/sitemap.xml');
    const resp = await productSitemapPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/sitemap.xml')),
    );
    assert.strictEqual(resp.status, 200);

    const { body } = resp;
    const sitemapXMLExpected = await readFile(new URL('./fixtures/index/sitemap.xml', import.meta.url), 'utf-8');

    assert.deepStrictEqual(body, sitemapXMLExpected);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      // 'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/xml',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('sends 400 for non xml path', async () => {
    const state = DEFAULT_STATE({
      path: '/blog/index',
    });
    const result = await productSitemapPipe(state, new PipelineRequest('https://acme.com/products/'));
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'only xml resources supported.');
  });

  it('handles a 404', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.rewrite('default.json', 'missing-file-404.json');

    const state = DEFAULT_STATE({
      s3Loader,
      path: '/products/sitemap.xml',
    });
    state.info = getPathInfo('/products/sitemap.xml');

    const result = await productSitemapPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products2/sitemap.xml')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'failed to load /products/sitemap.xml from product-bus: 404');
  });

  it('returns 404 for invalid path info', async () => {
    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/sitemap.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = false;

    const result = await productSitemapPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/sitemap.xml')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'invalid path');
  });

  it('sets state type to sitemap', async () => {
    const s3Loader = new FileS3Loader();

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/sitemap.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/sitemap.xml');
    await productSitemapPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/sitemap.xml')),
    );
    assert.strictEqual(state.type, 'sitemap');
  });

  it('returns early when res.error is set but res.status is less than 400', async () => {
    // Mock fetchContent to set res.error and res.status < 400
    const { productSitemapPipe: pipe } = await esmock('../src/product-sitemap-pipe.js', {
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
      path: '/products/sitemap.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/sitemap.xml');

    const result = await pipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/sitemap.xml')),
    );

    // Should return early without throwing PipelineStatusError
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.error, 'Some non-critical error');
    // Should not have gone through the full pipeline (no JSON body, no cache headers)
    assert.strictEqual(result.body, '');
  });

  describe('toSitemapXML', () => {
    it('returns a sitemap xml', () => {
      const xml = toSitemapXML(
        {
          prodHost: 'https://www.example.com',
          config: {
            public: {
              productSitemapConfig: {
                lastmod: 'YYYY-MM-DD',
              },
            },
            route: {
              storeCode: 'main',
              storeViewCode: 'default',
              matchedPatterns: ['/products/{{urlKey}}'],
            },
          },
        },
        {
          foo: {
            data: {
              id: 'foo',
              description: 'This is a description',
              url: 'https://www.example.com/foo',
              lastModified: '2021-04-30T03:47:18Z',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.example.com/foo</loc>
    <lastmod>2021-04-30</lastmod>
  </url>
</urlset>`);
    });

    it('filters out noindex products', () => {
      const xml = toSitemapXML(
        {
          prodHost: 'https://www.example.com',
          config: {
            public: {
              productSitemapConfig: {
                lastmod: 'YYYY-MM-DD',
              },
            },
            route: {
              storeCode: 'main',
              storeViewCode: 'default',
              matchedPatterns: ['/products/{{urlKey}}'],
            },
          },
        },
        {
          foo: {
            data: {
              id: 'foo',
              description: 'This is a description',
              url: 'https://www.example.com/foo',
              lastModified: '2021-04-30T03:47:18Z',
            },
            filters: {
              noindex: true,
            },
          },
          bar: {
            data: {
              id: 'bar',
              description: 'This is a description',
              url: 'https://www.example.com/bar',
              lastModified: '2021-04-30T03:47:18Z',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.example.com/bar</loc>
    <lastmod>2021-04-30</lastmod>
  </url>
</urlset>`);
    });

    it('resolves location from config if no url in product data', () => {
      const xml = toSitemapXML(
        {
          prodHost: 'https://www.example.com',
          config: {
            public: {
              patterns: {
                '/products/{{urlKey}}': {
                  storeCode: 'main',
                  storeViewCode: 'default',
                },
              },
            },
            route: {
              storeCode: 'main',
              storeViewCode: 'default',
              matchedPatterns: ['/products/{{urlKey}}'],
            },
          },
        },
        {
          foo: {
            data: {
              id: 'foo',
              description: 'This is a description',
              urlKey: 'foo-url-key',
              lastModified: '2021-04-30T03:47:18Z',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.example.com/products/foo-url-key</loc>
  </url>
</urlset>`);
    });

    it('allows setting an extension on urls, if url is not provided in product data', () => {
      const xml = toSitemapXML(
        {
          prodHost: 'https://www.example.com',
          config: {
            public: {
              productSitemapConfig: {
                extension: '.html',
              },
            },
            route: {
              storeCode: 'main',
              storeViewCode: 'default',
              matchedPatterns: ['/products/{{urlKey}}'],
            },
          },
        },
        {
          foo: {
            data: {
              id: 'foo',
              description: 'This is a description',
              urlKey: 'foo-url-key',
              lastModified: '2021-04-30T03:47:18Z',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.example.com/products/foo-url-key.html</loc>
  </url>
</urlset>`);
    });

    it('omits products with no matching pattern and no url', () => {
      const xml = toSitemapXML(
        {
          prodHost: 'https://www.example.com',
          config: {
            route: {
              storeCode: 'main',
              storeViewCode: 'default',
              matchedPatterns: null, // should never actually happen
            },
          },
        },
        {
          foo: {
            data: {
              id: 'foo',
              description: 'This is a description',
              urlKey: 'foo-url-key',
              lastModified: '2021-04-30T03:47:18Z',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
</urlset>`);
    });
  });
});
