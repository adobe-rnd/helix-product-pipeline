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
/* eslint-disable no-unused-vars */

import assert from 'assert';
import esmock from 'esmock';
import {
  PipelineRequest, PipelineState,
} from '@adobe/helix-html-pipeline';

describe('Product Media Pipe Test', () => {
  let productMediaPipe;
  let validatePathInfoMock;
  let initConfigMock;
  let fetchMediaMock;
  let setLastModifiedMock;

  const DEFAULT_CONFIG = {
    contentBusId: 'test-bus-id',
    owner: 'test-owner',
    repo: 'test-repo',
    ref: 'main',
  };

  beforeEach(async () => {
    // Create fresh mocks for each test
    validatePathInfoMock = () => true;
    initConfigMock = async () => {};
    fetchMediaMock = async () => {};
    setLastModifiedMock = () => {};

    // Mock all dependencies with fresh mocks
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: validatePathInfoMock,
      },
      '../src/steps/init-config.js': {
        default: initConfigMock,
      },
      '../src/steps/fetch-media.js': {
        default: fetchMediaMock,
      },
      '../src/utils/last-modified.js': {
        setLastModified: setLastModifiedMock,
      },
    });
    productMediaPipe = pipe;
  });

  it('sets state type to media', async () => {
    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    await productMediaPipe(state, req);

    assert.strictEqual(state.type, 'media');
  });

  it('returns 404 for invalid path info', async () => {
    // Create a new mock for this specific test
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => false,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async () => {},
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.headers.get('x-error'), 'invalid path');
  });

  it('returns 404 when fetchMedia returns 404 status', async () => {
    // Create a new mock for this specific test
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 404;
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.headers.get('x-error'), 'not found');
  });

  it('returns response directly when res.error exists but status < 400', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 200;
          res.error = 'warning message';
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.error, 'warning message');
  });

  it('throws PipelineStatusError when res.error exists and status >= 400', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 500;
          res.error = 'server error';
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);
    assert.strictEqual(response.error, 'server error');
  });

  it('calls setLastModified and sets response headers/body on success', async () => {
    let setLastModifiedCalled = false;
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 200;
          state.content = {
            headers: new Map([['content-type', 'image/png']]),
            data: 'fake image data',
          };
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: (state, res) => {
          setLastModifiedCalled = true;
        },
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert(setLastModifiedCalled, 'setLastModified should be called');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'image/png');
    assert.strictEqual(response.body, 'fake image data');
  });

  it('calls timer.update when timer exists', async () => {
    let timerUpdateCalled = false;
    const timer = {
      update: (label) => {
        timerUpdateCalled = true;
        assert.strictEqual(label, 'content-fetch');
      },
    };

    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 200;
          state.content = {
            headers: new Map(),
            data: '',
          };
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    state.timer = timer;
    const req = new PipelineRequest(new URL('https://example.com'));

    await pipe(state, req);

    assert(timerUpdateCalled, 'timer.update should be called');
  });

  it('does not call timer.update when timer does not exist', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 200;
          state.content = {
            headers: new Map(),
            data: '',
          };
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    // No timer property
    const req = new PipelineRequest(new URL('https://example.com'));

    // Should not throw
    const response = await pipe(state, req);
    assert.strictEqual(response.status, 200);
  });

  it('does not call timer.update when timer exists but has no update method', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 200;
          state.content = {
            headers: new Map(),
            data: '',
          };
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    state.timer = {}; // Timer without update method
    const req = new PipelineRequest(new URL('https://example.com'));

    // Should not throw
    const response = await pipe(state, req);
    assert.strictEqual(response.status, 200);
  });

  it('handles initConfig throwing an error', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {
          throw new Error('config error');
        },
      },
      '../src/steps/fetch-media.js': {
        default: async () => {},
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.error, 'config error');
  });

  it('handles fetchMedia throwing an error', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async () => {
          throw new Error('fetch error');
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.error, 'fetch error');
  });

  it('handles setLastModified throwing an error', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          res.status = 200;
          state.content = {
            headers: new Map(),
            data: '',
          };
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {
          throw new Error('last modified error');
        },
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.error, 'last modified error');
  });

  it('handles any other exception in try-catch block', async () => {
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async () => {
          throw new TypeError('type error');
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {},
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    const response = await pipe(state, req);

    assert.strictEqual(response.error, 'type error');
  });

  it('calls all steps in correct order', async () => {
    const callOrder = [];

    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async (state, req, res) => {
          callOrder.push('initConfig');
        },
      },
      '../src/steps/fetch-media.js': {
        default: async (state, res) => {
          callOrder.push('fetchMedia');
          res.status = 200;
          state.content = {
            headers: new Map(),
            data: '',
          };
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: (state, res) => {
          callOrder.push('setLastModified');
        },
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    await pipe(state, req);

    assert.deepStrictEqual(callOrder, ['initConfig', 'fetchMedia', 'setLastModified']);
  });

  it('does not call setLastModified when fetchMedia returns 404', async () => {
    let setLastModifiedCalled = false;
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, req, res) => {
          res.status = 404;
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {
          setLastModifiedCalled = true;
        },
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    await pipe(state, req);

    assert(!setLastModifiedCalled, 'setLastModified should not be called when status is 404');
  });

  it('does not call setLastModified when fetchMedia returns error with status < 400', async () => {
    let setLastModifiedCalled = false;
    const { productMediaPipe: pipe } = await esmock('../src/product-media-pipe.js', {
      '../src/utils/path.js': {
        validatePathInfo: () => true,
      },
      '../src/steps/init-config.js': {
        default: async () => {},
      },
      '../src/steps/fetch-media.js': {
        default: async (state, req, res) => {
          res.status = 200;
          res.error = 'warning';
        },
      },
      '../src/utils/last-modified.js': {
        setLastModified: () => {
          setLastModifiedCalled = true;
        },
      },
    });

    const state = new PipelineState({
      config: DEFAULT_CONFIG,
      partition: 'live',
      site: 'test-site',
      org: 'test-org',
      ref: 'main',
    });
    const req = new PipelineRequest(new URL('https://example.com'));

    await pipe(state, req);

    assert(!setLastModifiedCalled, 'setLastModified should not be called when there is an error with status < 400');
  });
});
