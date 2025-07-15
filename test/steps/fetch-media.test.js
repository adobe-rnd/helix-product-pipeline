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

/* eslint-disable no-await-in-loop */

/* eslint-env mocha */
import assert from 'assert';
import { PipelineResponse } from '@adobe/helix-html-pipeline';
import { FileS3Loader } from '../FileS3Loader.js';
import fetchMedia from '../../src/steps/fetch-media.js';

describe('fetchMedia', () => {
  let s3Loader;
  let state;
  let req;
  let res;

  beforeEach(() => {
    s3Loader = new FileS3Loader();

    state = {
      info: {
        originalFilename: 'media_11fa1411c77cbc54df349acdf818c84519d82750.png',
        resourcePath: '/media_11fa1411c77cbc54df349acdf818c84519d82750.png',
      },
      owner: 'test-owner',
      repo: 'test-repo',
      s3Loader,
      content: {},
    };

    req = {};
    res = new PipelineResponse('');
  });

  it('successfully loads media and sets content data', async () => {
    // Use the existing fixture file
    state.info.originalFilename = 'media_11fa1411c77cbc54df349acdf818c84519d82750.png';
    state.info.resourcePath = '/media_11fa1411c77cbc54df349acdf818c84519d82750.png';

    s3Loader.override('media_11fa1411c77cbc54df349acdf818c84519d82750.png', Buffer.from([]));
    s3Loader.headers('media_11fa1411c77cbc54df349acdf818c84519d82750.png', 'content-type', 'image/png');
    s3Loader.headers('media_11fa1411c77cbc54df349acdf818c84519d82750.png', 'content-length', '1000');

    await fetchMedia(state, req, res);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.error, undefined);
    assert.ok(state.content.data);
    assert.equal(state.content.headers.get('content-type'), 'image/png');
    assert.equal(state.content.headers.get('content-length'), '1000');
  });

  it('returns last modified when media is successfully loaded', async () => {
    // Use the existing fixture file
    state.info.originalFilename = 'media_11fa1411c77cbc54df349acdf818c84519d82750.png';
    state.info.resourcePath = '/media_11fa1411c77cbc54df349acdf818c84519d82750.png';

    s3Loader.override('media_11fa1411c77cbc54df349acdf818c84519d82750.png', Buffer.from([]));
    s3Loader.headers('media_11fa1411c77cbc54df349acdf818c84519d82750.png', 'last-modified', 'Tue, 15 Jul 2025 12:00:00 GMT');
    await fetchMedia(state, req, res);

    assert.strictEqual(res.status, 200);
    // Verify that lastModifiedSources is set (this is handled by recordLastModified)
    assert.ok(res.lastModifiedSources);
    assert.ok(res.lastModifiedSources.content);
    assert.equal(res.lastModifiedSources.content.time, 1752580800000);
    assert.equal(res.lastModifiedSources.content.date, 'Tue, 15 Jul 2025 12:00:00 GMT');
  });

  it('handles 404 error correctly', async () => {
    // Use a non-existent file to trigger 404
    state.info.originalFilename = 'non-existent-file.png';
    state.info.resourcePath = '/non-existent-file.png';

    await fetchMedia(state, req, res);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.error, 'failed to load /non-existent-file.png from product-bus: 404');
  });

  it('handles various error status codes', async () => {
    const errorStatuses = [403, 500, 503, 504];

    for (const status of errorStatuses) {
      // Reset state for each test
      s3Loader.status('media_11fa1411c77cbc54df349acdf818c84519d82750.png', status);
      state.info.originalFilename = 'media_11fa1411c77cbc54df349acdf818c84519d82750.png';
      state.info.resourcePath = '/media_11fa1411c77cbc54df349acdf818c84519d82750.png';
      res.status = 200;
      res.error = undefined;

      await fetchMedia(state, req, res);

      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.error, `failed to load /media_11fa1411c77cbc54df349acdf818c84519d82750.png from product-bus: ${status}`);
    }
  });
});
