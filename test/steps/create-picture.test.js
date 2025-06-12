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
import { constructImageUrl } from '../../src/steps/create-pictures.js';

describe('constructImageUrl', () => {
  const baseState = {
    ref: 'main',
    site: 'helix-pages',
    org: 'adobe',
    config: {
      partition: 'preview',
    },
  };

  it('returns the original URL if it does not start with ./ or /', () => {
    const url = 'https://example.com/image.jpg';
    const result = constructImageUrl(baseState, url);
    assert.strictEqual(result, url);
  });

  it('returns the correct URL if it starts with / and no .', () => {
    const state = {
      ...baseState,
      partition: 'preview',
    };
    const url = '/images/test.jpg';
    const result = constructImageUrl(state, url);
    assert.strictEqual(result, 'https://main--helix-pages--adobe.aem.page/images/test.jpg');
  });

  it('constructs preview URL with previewHost when available', () => {
    const state = {
      ...baseState,
      partition: 'preview',
      previewHost: 'preview.example.com',
    };
    const result = constructImageUrl(state, './images/test.jpg');
    assert.strictEqual(result, 'https://preview.example.com/images/test.jpg');
  });

  it('constructs live URL with prodHost when available', () => {
    const state = {
      ...baseState,
      partition: 'live',
      prodHost: 'www.example.com',
    };
    const result = constructImageUrl(state, './images/test.jpg');
    assert.strictEqual(result, 'https://www.example.com/images/test.jpg');
  });

  it('constructs preview URL with default domain when no previewHost', () => {
    const state = {
      ...baseState,
      partition: 'preview',
    };
    const result = constructImageUrl(state, './images/test.jpg');
    assert.strictEqual(result, 'https://main--helix-pages--adobe.aem.page/images/test.jpg');
  });

  it('constructs live URL with default domain when no prodHost', () => {
    const state = {
      ...baseState,
      partition: 'live',
    };
    const result = constructImageUrl(state, './images/test.jpg');
    assert.strictEqual(result, 'https://main--helix-pages--adobe.aem.live/images/test.jpg');
  });

  it('removes trailing slash from path', () => {
    const state = {
      ...baseState,
      config: { partition: 'preview' },
    };
    const result = constructImageUrl(state, './images/test.jpg/');
    assert.strictEqual(result, 'https://main--helix-pages--adobe.aem.page/images/test.jpg');
  });

  it('removes trailing slash from host', () => {
    const state = {
      ...baseState,
      partition: 'preview',
      previewHost: 'preview.example.com/',
    };
    const result = constructImageUrl(state, './images/test.jpg');
    assert.strictEqual(result, 'https://preview.example.com/images/test.jpg');
  });

  it('handles paths with multiple segments', () => {
    const state = {
      ...baseState,
      partition: 'preview',
    };
    const result = constructImageUrl(state, './images/products/featured/test.jpg');
    assert.strictEqual(result, 'https://main--helix-pages--adobe.aem.page/images/products/featured/test.jpg');
  });
});
