/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { PipelineRequest, PipelineResponse } from '@adobe/helix-html-pipeline';
import { setCachingHeaders, isMediaRequest } from '../../src/steps/set-cache-headers.js';

describe('setCachingHeaders', () => {
  const createState = (overrides = {}) => ({
    ref: 'main',
    site: 'helix-pages',
    org: 'adobe',
    contentBusId: 'foo-id',
    ...overrides,
  });

  const createRequest = (url, headers = {}) => {
    const req = new PipelineRequest(new URL(url));
    Object.entries(headers).forEach(([key, value]) => {
      req.headers.set(key, value);
    });
    return req;
  };

  const createResponse = (status = 200) => {
    const resp = new PipelineResponse('', { status });
    if (status < 300) {
      resp.ok = true;
    }
    return resp;
  };

  describe('CDN type detection', () => {
    it('uses x-byo-cdn-type header when valid', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse();
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=300, must-revalidate');
      assert.strictEqual(resp.headers.get('cache-tag'), 'key1,key2,main--helix-pages--adobe/test,/test');
    });

    it('sniffs Akamai from via header', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        via: 'AkamaiGHost',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('edge-control'), '!no-store,max-age=300s,downstream-ttl=7200s');
      assert.strictEqual(resp.headers.get('edge-cache-tag'), 'key1');
    });

    it('sniffs Akamai from via header (case insensitive)', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        via: 'akamaiGHost',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('edge-control'), '!no-store,max-age=300s,downstream-ttl=7200s');
    });

    it('sniffs Fastly from via header with varnish', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        via: 'varnish',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('surrogate-control'), 'max-age=300, stale-while-revalidate=0');
      assert.strictEqual(resp.headers.get('surrogate-key'), 'key1');
    });

    it('sniffs Fastly from cdn-loop header', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'cdn-loop': 'Fastly',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('surrogate-control'), 'max-age=300, stale-while-revalidate=0');
    });

    it('sniffs Cloudflare from cdn-loop header', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'cdn-loop': 'cloudflare',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=300, must-revalidate');
      assert.strictEqual(resp.headers.get('cache-tag'), 'key1,main--helix-pages--adobe/test,/test');
    });

    it('sniffs Cloudflare from cf-worker header', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'cf-worker': 'true',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=300, must-revalidate');
    });

    it('sniffs CloudFront from via header', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        via: 'CloudFront',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'max-age=7200, s-maxage=300, must-revalidate');
    });

    it('sets undefined for unsupported CDN type', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        via: 'unknown-cdn',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      // Should not set any CDN-specific headers
      assert.strictEqual(resp.headers.get('cdn-cache-control'), undefined);
      assert.strictEqual(resp.headers.get('surrogate-control'), undefined);
      assert.strictEqual(resp.headers.get('edge-control'), undefined);
      assert.strictEqual(resp.headers.get('surrogate-key'), undefined);
      assert.strictEqual(resp.headers.get('edge-cache-tag'), undefined);
      assert.strictEqual(resp.headers.get('cache-tag'), undefined);
    });

    it('ignores invalid x-byo-cdn-type and sniffs instead', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'invalid-cdn',
        via: 'CloudFront',
      });
      const resp = createResponse();
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'max-age=7200, s-maxage=300, must-revalidate');
    });
  });

  describe('Browser TTL and cache-control', () => {
    it('sets no-cache for 302 status', () => {
      const state = createState();
      const req = createRequest('https://example.com/test');
      const resp = createResponse(302);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'private; no-cache');
    });

    it('sets no-cache for 400 status', () => {
      const state = createState();
      const req = createRequest('https://example.com/test');
      const resp = createResponse(400);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'private; no-cache');
    });

    it('sets no-cache for 401 status', () => {
      const state = createState();
      const req = createRequest('https://example.com/test');
      const resp = createResponse(401);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'private; no-cache');
    });

    it('sets 7200s TTL for regular requests', () => {
      const state = createState();
      const req = createRequest('https://example.com/test');
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'max-age=7200, must-revalidate');
    });

    it('sets 2592000s TTL for successful media requests', () => {
      const state = createState();
      const req = createRequest('https://example.com/media_1234567890abcdef1234567890abcdef12345678.jpg', {
        'x-byo-cdn-type': 'fastly',
      });
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'max-age=2592000, must-revalidate');
    });

    it('sets 3600s TTL for failed media requests', () => {
      const state = createState();
      const req = createRequest('https://example.com/media_1234567890abcdef1234567890abcdef12345678.jpg');
      const resp = createResponse(404);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'max-age=3600, must-revalidate');
    });
  });

  describe('CDN TTL calculation', () => {
    it('sets 0 TTL for 400 status', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(400);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=0, must-revalidate');
    });

    it('sets 0 TTL for 401 status', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(401);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=0, must-revalidate');
    });

    it('sets 2592000s TTL for successful media requests', () => {
      const state = createState();
      const req = createRequest('https://example.com/media_1234567890abcdef1234567890abcdef12345678.jpg', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=2592000, must-revalidate');
    });

    it('sets 3600s TTL for failed media requests', () => {
      const state = createState();
      const req = createRequest('https://example.com/media_1234567890abcdef1234567890abcdef12345678.jpg', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(404);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=3600, must-revalidate');
    });

    it('sets 300s TTL for regular requests without push invalidation', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=300, must-revalidate');
    });

    it('sets 172800s TTL for regular requests with push invalidation', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
        'x-push-invalidation': 'enabled',
      });
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=172800, must-revalidate');
    });
  });

  describe('CDN-specific headers', () => {
    it('sets Cloudflare headers correctly', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), 'max-age=300, must-revalidate');
      assert.strictEqual(resp.headers.get('cache-tag'), 'key1,key2,main--helix-pages--adobe/test,/test');
    });

    it('sets Fastly headers correctly', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'fastly',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('surrogate-control'), 'max-age=300, stale-while-revalidate=0');
      assert.strictEqual(resp.headers.get('surrogate-key'), 'key1 key2');
    });

    it('sets Akamai headers correctly', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'akamai',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('edge-control'), '!no-store,max-age=300s,downstream-ttl=7200s');
      assert.strictEqual(resp.headers.get('edge-cache-tag'), 'key1 key2');
    });

    it('sets CloudFront headers correctly', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudfront',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-control'), 'max-age=7200, s-maxage=300, must-revalidate');
      // CloudFront doesn't support cache tags
      assert.strictEqual(resp.headers.get('cache-tag'), undefined);
    });

    it('does not set CDN headers for unsupported CDN', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'unsupported',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cdn-cache-control'), undefined);
      assert.strictEqual(resp.headers.get('surrogate-control'), undefined);
      assert.strictEqual(resp.headers.get('edge-control'), undefined);
      assert.strictEqual(resp.headers.get('cache-tag'), undefined);
    });
  });

  describe('Cache keys/tags', () => {
    it('sets cache tags for Cloudflare with multiple keys', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2', 'key3'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-tag'), 'key1,key2,key3,main--helix-pages--adobe/test,/test');
    });

    it('sets cache tags for Akamai with multiple keys', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'akamai',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('edge-cache-tag'), 'key1 key2');
    });

    it('sets cache keys for Fastly with multiple keys', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'fastly',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('surrogate-key'), 'key1 key2');
    });

    it('does not set cache tags for CloudFront', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudfront',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-tag'), undefined);
    });

    it('does not set cache tags when no keys provided', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-tag'), undefined);
    });

    it('does not set cache tags for unsupported CDN', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'unsupported',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1', 'key2'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-tag'), undefined);
      assert.strictEqual(resp.headers.get('edge-cache-tag'), undefined);
      assert.strictEqual(resp.headers.get('surrogate-key'), undefined);
    });
  });

  describe('Edge cases', () => {
    it('handles empty via and cdn-loop headers', () => {
      const state = createState();
      const req = createRequest('https://example.com/test', {
        via: '',
        'cdn-loop': '',
      });
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      // Should not set any CDN-specific headers
      assert.strictEqual(resp.headers.get('cdn-cache-control'), undefined);
      assert.strictEqual(resp.headers.get('surrogate-control'), undefined);
      assert.strictEqual(resp.headers.get('edge-control'), undefined);
    });

    it('handles missing via and cdn-loop headers', () => {
      const state = createState();
      const req = createRequest('https://example.com/test');
      const resp = createResponse(200);
      const cacheKeys = [];

      setCachingHeaders(state, req, resp, cacheKeys);

      // Should not set any CDN-specific headers
      assert.strictEqual(resp.headers.get('cdn-cache-control'), undefined);
      assert.strictEqual(resp.headers.get('surrogate-control'), undefined);
      assert.strictEqual(resp.headers.get('edge-control'), undefined);
    });

    it('handles complex URL with query parameters', () => {
      const state = createState();
      const req = createRequest('https://example.com/test/path?param=value', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-tag'), 'key1,main--helix-pages--adobe/test/path,/test/path');
    });

    it('handles state with different ref, site, and org', () => {
      const state = createState({
        ref: 'feature-branch',
        site: 'my-site',
        org: 'my-org',
      });
      const req = createRequest('https://example.com/test', {
        'x-byo-cdn-type': 'cloudflare',
      });
      const resp = createResponse(200);
      const cacheKeys = ['key1'];

      setCachingHeaders(state, req, resp, cacheKeys);

      assert.strictEqual(resp.headers.get('cache-tag'), 'key1,feature-branch--my-site--my-org/test,/test');
    });
  });
});

describe('isMediaRequest', () => {
  it('returns true for valid media URLs', () => {
    const url = new URL('https://example.com/media_1234567890abcdef1234567890abcdef12345678.jpg');
    assert.strictEqual(isMediaRequest(url), true);
  });

  it('returns true for media URLs with additional path segments', () => {
    const url = new URL('https://example.com/media_1234567890abcdef1234567890abcdef12345678/thumbnails/small.jpg');
    assert.strictEqual(isMediaRequest(url), true);
  });

  it('returns true for media URLs with different extensions', () => {
    const url = new URL('https://example.com/media_1234567890abcdef1234567890abcdef12345678.png');
    assert.strictEqual(isMediaRequest(url), true);
  });

  it('returns false for non-media URLs', () => {
    const url = new URL('https://example.com/test.html');
    assert.strictEqual(isMediaRequest(url), false);
  });

  it('returns false for URLs with short hash', () => {
    const url = new URL('https://example.com/media_1234567890abcdef.jpg');
    assert.strictEqual(isMediaRequest(url), false);
  });

  it('returns false for URLs without hash', () => {
    const url = new URL('https://example.com/media.jpg');
    assert.strictEqual(isMediaRequest(url), false);
  });
});
