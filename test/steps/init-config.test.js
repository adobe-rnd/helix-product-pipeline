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
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'main',
        info: { path: '/test/path' },
        config: {
          cdn: {
            preview: { host: 'https://$ref--$site--$org.example.com' },
            live: { host: 'https://$org.$site.com' },
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
        'https://testorg.testsite.com',
      );
    });

    it('should return empty string when input string is null', async () => {
      const state = {
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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

  describe('initConfig main function', () => {
    it('should set prodHost from config when available', async () => {
      const state = {
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {
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

    it('should handle missing cdn config gracefully', async () => {
      const state = {
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        config: {},
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = {};

      await initConfig(state, req, res);

      assert.strictEqual(state.previewHost, '');
      assert.strictEqual(state.liveHost, '');
      assert.strictEqual(state.prodHost, 'original-host.com');
    });

    it('should record lastModified from config', async () => {
      const state = {
        org: 'testorg',
        site: 'testsite',
        repo: 'testrepo',
        ref: 'testref',
        info: { path: '/test/path' },
        log: console,
        config: {
          lastModified: 'Wed, 22 Oct 2025 03:47:18 GMT',
          cdn: {
            preview: { host: 'https://preview.example.com' },
            live: { host: 'https://live.example.com' },
          },
        },
      };

      const req = { headers: { get: () => 'original-host.com' } };
      const res = { lastModifiedSources: {} };

      await initConfig(state, req, res);

      assert.strictEqual(res.lastModifiedSources.config.date, 'Wed, 22 Oct 2025 03:47:18 GMT');
    });
  });
});
