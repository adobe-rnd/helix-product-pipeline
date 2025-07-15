/*
 * Copyright 2024 Adobe. All rights reserved.
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
import initConfig from '../../src/steps/init-config.js';

describe('init-config', () => {
  describe('replaceParams function (tested through initConfig)', () => {
    it('should replace all parameter placeholders with correct values', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'main',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: 'https://$ref--$site--$org.example.com' },
            live: { host: 'https://$owner.$org.$site.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(
        state.previewHost,
        'https://main--testsite--testorg.example.com',
      );
      assert.strictEqual(
        state.liveHost,
        'https://testowner.testorg.testsite.com',
      );
    });

    it('should return empty string when input string is null', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: null },
            live: { host: undefined },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.previewHost, '');
      assert.strictEqual(state.liveHost, '');
    });

    it('should return empty string when input string is empty', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: '' },
            live: { host: '' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.previewHost, '');
      assert.strictEqual(state.liveHost, '');
    });

    it('should handle strings with no parameter placeholders', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: 'https://static.example.com' },
            live: { host: 'https://cdn.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.previewHost, 'https://static.example.com');
      assert.strictEqual(state.liveHost, 'https://cdn.example.com');
    });

    it('should handle partial parameter replacements', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: 'https://$ref.example.com' },
            live: { host: 'https://$org.$site.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.previewHost, 'https://testref.example.com');
      assert.strictEqual(state.liveHost, 'https://testorg.testsite.com');
    });

    it('should handle multiple occurrences of the same parameter', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: 'https://$ref.$ref.example.com' },
            live: { host: 'https://$org.$org.$site.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.previewHost, 'https://testref.testref.example.com');
      assert.strictEqual(state.liveHost, 'https://testorg.testorg.testsite.com');
    });
  });

  describe('findOrderedMatches function (tested through initConfig)', () => {
    it('should find and order pattern matches correctly', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/products/123' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
              '/products/*': { productConfig: 'product' },
              '/products/{{id}}': { productDetailConfig: 'productDetail' },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.deepStrictEqual(state.config.route.matchedPatterns, ['/products/*', '/products/{{id}}']);
    });
  });

  describe('extractPathParams function (tested through initConfig)', () => {
    it('should extract parameters from patterns with placeholders', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/products/123' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
              '/products/{{sku}}': {
                type: 'product',
              },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.deepStrictEqual(state.config.route.params, { sku: '123' });
    });

    it('should extract multiple parameters from complex patterns', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/category/product/product-url-key/456' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
              '/category/product/{{urlKey}}/{{sku}}': {
                type: 'product',
              },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.deepStrictEqual(state.config.route.params, {
        urlKey: 'product-url-key',
        sku: '456',
      });
    });

    it('should handle no match', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/category' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
              '/category/product': {
                type: 'product',
              },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.deepStrictEqual(state.config.route.params, {});
    });
  });

  describe('initConfig main function', () => {
    it('should set prodHost from config when available', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
            prod: { host: 'https://prod.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.prodHost, 'https://prod.example.com');
    });

    it('should fallback to x-forwarded-host when prod host not configured', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              base: { someConfig: 'base' },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const headers = new Headers();
      headers.set('x-forwarded-host', 'original-host.com');
      const req = { headers };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.prodHost, 'original-host.com');
    });

    it('should merge base config with pattern-specific config', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/products/123' },
        config: {
          public: {
            patterns: {
              base: {
                baseConfig: 'base',
                sharedConfig: 'shared',
              },
              '/products/{{id}}': {
                productConfig: 'product',
                sharedConfig: 'overridden',
              },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.config.route.baseConfig, 'base');
      assert.strictEqual(state.config.route.productConfig, 'product');
      assert.strictEqual(state.config.route.sharedConfig, 'overridden');
    });

    it('should handle missing base config gracefully', async () => {
      const state = {
        owner: 'testowner',
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
          public: {
            patterns: {
              '/test/*': { testConfig: 'test' },
            },
          },
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.config.route.testConfig, 'test');
      assert.deepStrictEqual(state.config.route.params, {});
    });
  });
});
