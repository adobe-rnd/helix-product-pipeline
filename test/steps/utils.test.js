/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* global describe, it */
import assert from 'assert';
import { PipelineRequest } from '@adobe/helix-html-pipeline';
import {
  getOriginalHost,
  stripHTML,
  maybeHTML,
  limitWords,
  getIncludes,
  getPaginationParams,
} from '../../src/steps/utils.js';

describe('Get Original Host', () => {
  it('get correct host for plain host header', () => {
    const headers = new Map([['host', 'blog.adobe.com']]);
    assert.strictEqual(getOriginalHost(headers), 'blog.adobe.com');
  });

  it('get correct host for plain xfwd header', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', 'spark.adobe.com'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'spark.adobe.com');
  });

  it('get correct host for multiple plain xfwd header', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', 'spark.adobe.com, cdn1.hlx.page'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'spark.adobe.com');
  });

  it('get correct host for multiple plain xfwd header if first segment is empty', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', '  , spark.adobe.com, cdn1.hlx.page'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'spark.adobe.com');
  });

  it('get correct host for multiple plain xfwd header if all segments are empty', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', '  ,  ,'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'blog.adobe.com');
  });
});

describe('Strip HTML', () => {
  it('returns empty string for null/undefined input', () => {
    assert.strictEqual(stripHTML(null), '');
    assert.strictEqual(stripHTML(undefined), '');
    assert.strictEqual(stripHTML(''), '');
  });

  it('strips simple HTML tags', () => {
    assert.strictEqual(stripHTML('<p>Hello World</p>'), 'Hello World');
    assert.strictEqual(stripHTML('<div>Content</div>'), 'Content');
    assert.strictEqual(stripHTML('<span>Text</span>'), 'Text');
  });

  it('strips nested HTML tags', () => {
    assert.strictEqual(stripHTML('<div><p>Hello <strong>World</strong></p></div>'), 'Hello World');
    assert.strictEqual(stripHTML('<article><header><h1>Title</h1></header><p>Content</p></article>'), 'Title Content');
  });

  it('handles self-closing tags', () => {
    assert.strictEqual(stripHTML('<img src="image.jpg" alt="test" />'), '');
    assert.strictEqual(stripHTML('<br />'), '');
    assert.strictEqual(stripHTML('<hr />'), '');
  });

  it('handles tags with attributes', () => {
    assert.strictEqual(stripHTML('<p class="test" id="main">Content</p>'), 'Content');
    assert.strictEqual(stripHTML('<a href="https://example.com" target="_blank">Link</a>'), 'Link');
  });

  it('handles malformed HTML gracefully', () => {
    assert.strictEqual(stripHTML('<p>Content'), 'Content');
    assert.strictEqual(stripHTML('Content</p>'), 'Content');
    assert.strictEqual(stripHTML('<p>Content<p>'), 'Content');
  });

  it('decodes common HTML entities', () => {
    assert.strictEqual(stripHTML('<p>&nbsp;Hello&nbsp;World&nbsp;</p>'), 'Hello World');
    assert.strictEqual(stripHTML('<p>Hello &amp; World</p>'), 'Hello & World');
    assert.strictEqual(stripHTML('<p>&quot;Quoted text&quot;</p>'), '"Quoted text"');
    assert.strictEqual(stripHTML('<p>Don&#39;t stop</p>'), "Don't stop");
    assert.strictEqual(stripHTML('<p>5 &lt; 10 &gt; 3</p>'), '5 < 10 > 3');
  });

  it('collapses whitespace and trims', () => {
    assert.strictEqual(stripHTML('<p>  Hello   World  </p>'), 'Hello World');
    assert.strictEqual(stripHTML('<div>\n\tContent\n\t</div>'), 'Content');
    assert.strictEqual(stripHTML('<p>Multiple    spaces</p>'), 'Multiple spaces');
  });

  it('handles complex HTML with mixed content', () => {
    const complexHTML = `
      <div class="container">
        <h1>Main Title</h1>
        <p>This is a <strong>bold</strong> paragraph with <em>italic</em> text.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <p>Another paragraph with &amp; symbols and &quot;quotes&quot;.</p>
      </div>
    `;
    const expected = 'Main Title This is a bold paragraph with italic text. Item 1 Item 2 Another paragraph with & symbols and "quotes".';
    assert.strictEqual(stripHTML(complexHTML), expected);
  });

  it('handles HTML comments', () => {
    assert.strictEqual(stripHTML('<p>Content<!-- comment --></p>'), 'Content');
    assert.strictEqual(stripHTML('<!-- comment --><p>Content</p>'), 'Content');
  });

  it('handles DOCTYPE and XML declarations', () => {
    assert.strictEqual(stripHTML('<!DOCTYPE html><html><body>Content</body></html>'), 'Content');
    assert.strictEqual(stripHTML('<?xml version="1.0"?><root>Content</root>'), 'Content');
  });
});

describe('Maybe HTML', () => {
  it('returns false for non-string inputs', () => {
    assert.strictEqual(maybeHTML(null), false);
    assert.strictEqual(maybeHTML(undefined), false);
    assert.strictEqual(maybeHTML(123), false);
    assert.strictEqual(maybeHTML({}), false);
    assert.strictEqual(maybeHTML([]), false);
  });

  it('returns false for strings shorter than 3 characters', () => {
    assert.strictEqual(maybeHTML(''), false);
    assert.strictEqual(maybeHTML('a'), false);
    assert.strictEqual(maybeHTML('ab'), false);
  });

  it('returns false for XML declarations', () => {
    assert.strictEqual(maybeHTML('<?xml version="1.0"?>'), false);
    assert.strictEqual(maybeHTML('<?php echo "hello"; ?>'), false);
  });

  it('returns false for DOCTYPE declarations', () => {
    assert.strictEqual(maybeHTML('<!DOCTYPE html>'), false);
    assert.strictEqual(maybeHTML('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN">'), false);
  });

  it('returns false for HTML comments', () => {
    assert.strictEqual(maybeHTML('<!-- comment -->'), false);
    assert.strictEqual(maybeHTML('<!--[if IE]>content<![endif]-->'), false);
  });

  it('returns true for strings starting with HTML tags', () => {
    assert.strictEqual(maybeHTML('<p>Hello</p>'), true);
    assert.strictEqual(maybeHTML('<div>Content</div>'), true);
    assert.strictEqual(maybeHTML('<span>Text</span>'), true);
    assert.strictEqual(maybeHTML('<h1>Title</h1>'), true);
    assert.strictEqual(maybeHTML('<a href="#">Link</a>'), true);
  });

  it('returns true for strings ending with HTML tags', () => {
    assert.strictEqual(maybeHTML('Hello<p>'), true);
    assert.strictEqual(maybeHTML('Content</div>'), true);
    assert.strictEqual(maybeHTML('Text</span>'), true);
    assert.strictEqual(maybeHTML('Title</h1>'), true);
    assert.strictEqual(maybeHTML('Link</a>'), true);
  });

  it('returns true for self-closing tags', () => {
    assert.strictEqual(maybeHTML('<img src="test.jpg" />'), true);
    assert.strictEqual(maybeHTML('<br />'), true);
    assert.strictEqual(maybeHTML('<hr />'), true);
    assert.strictEqual(maybeHTML('<input type="text" />'), true);
  });

  it('returns true for tags with attributes', () => {
    assert.strictEqual(maybeHTML('<p class="test" id="main">Content</p>'), true);
    assert.strictEqual(maybeHTML('<a href="https://example.com" target="_blank">Link</a>'), true);
    assert.strictEqual(maybeHTML('<div data-test="value">Content</div>'), true);
  });

  it('returns true for nested tags', () => {
    assert.strictEqual(maybeHTML('<div><p>Hello <strong>World</strong></p></div>'), true);
    assert.strictEqual(maybeHTML('<article><header><h1>Title</h1></header></article>'), true);
  });

  it('returns false for plain text', () => {
    assert.strictEqual(maybeHTML('Hello World'), false);
    assert.strictEqual(maybeHTML('This is plain text'), false);
    assert.strictEqual(maybeHTML('123456'), false);
  });

  it('returns false for malformed HTML-like strings', () => {
    assert.strictEqual(maybeHTML('<'), false);
    assert.strictEqual(maybeHTML('>'), false);
    assert.strictEqual(maybeHTML('<>'), false);
    assert.strictEqual(maybeHTML('<p'), false);
    assert.strictEqual(maybeHTML('p>'), false);
  });

  it('returns false for strings with < and > but not as tags', () => {
    assert.strictEqual(maybeHTML('5 < 10 > 3'), false);
    assert.strictEqual(maybeHTML('x < y and y > z'), false);
    assert.strictEqual(maybeHTML('a < b < c'), false);
  });

  it('returns true for edge cases with minimal valid HTML', () => {
    assert.strictEqual(maybeHTML('<p>'), true);
    assert.strictEqual(maybeHTML('</p>'), true);
    assert.strictEqual(maybeHTML('<br>'), true);
    assert.strictEqual(maybeHTML('<hr>'), true);
  });

  it('returns true for complex HTML structures', () => {
    const complexHTML = `
      <div class="container">
        <h1>Main Title</h1>
        <p>This is a <strong>bold</strong> paragraph.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    `;
    assert.strictEqual(maybeHTML(complexHTML), true);
  });
});

describe('Limit Words', () => {
  it('returns empty string for null/undefined input', () => {
    assert.strictEqual(limitWords(null), '');
    assert.strictEqual(limitWords(undefined), '');
    assert.strictEqual(limitWords(''), '');
  });

  it('returns text unchanged when word count is within limit', () => {
    assert.strictEqual(limitWords('Hello world'), 'Hello world');
    assert.strictEqual(limitWords('This is a short text'), 'This is a short text');
    assert.strictEqual(limitWords('One two three four five'), 'One two three four five');
  });

  it('truncates text when word count exceeds default limit of 25', () => {
    const longText = 'This is a very very very long text that contains more than twenty five words and should be truncated at the appropriate point with an ellipsis';
    const expected = 'This is a very very very long text that contains more than twenty five words and should be truncated at the appropriate point with an...';
    assert.strictEqual(limitWords(longText), expected);
  });

  it('respects custom maxWords parameter', () => {
    const text = 'One two three four five six seven eight nine ten';

    assert.strictEqual(limitWords(text, 3), 'One two three...');
    assert.strictEqual(limitWords(text, 5), 'One two three four five...');
    assert.strictEqual(limitWords(text, 7), 'One two three four five six seven...');
    assert.strictEqual(limitWords(text, 10), 'One two three four five six seven eight nine ten');
  });

  it('handles text with multiple consecutive spaces', () => {
    const text = 'Hello    world   with   multiple    spaces';
    assert.strictEqual(limitWords(text, 3), 'Hello world with...');
    assert.strictEqual(limitWords(text, 2), 'Hello world...');
  });

  it('handles text with tabs and newlines', () => {
    const text = 'Hello\tworld\nwith\tmultiple\nwhitespace\tcharacters';
    assert.strictEqual(limitWords(text, 3), 'Hello world with...');
    assert.strictEqual(limitWords(text, 4), 'Hello world with multiple...');
  });

  it('trims leading and trailing whitespace', () => {
    const text = '   Hello world   ';
    assert.strictEqual(limitWords(text, 2), 'Hello world');
    assert.strictEqual(limitWords(text, 1), 'Hello...');
  });

  it('handles single word text', () => {
    assert.strictEqual(limitWords('Hello'), 'Hello');
    assert.strictEqual(limitWords('   Hello   '), 'Hello');
  });

  it('handles edge case of exactly maxWords', () => {
    const text = 'One two three four five';
    assert.strictEqual(limitWords(text, 5), 'One two three four five');
    assert.strictEqual(limitWords(text, 4), 'One two three four...');
  });

  it('handles very long words', () => {
    const text = 'Supercalifragilisticexpialidocious Pneumonoultramicroscopicsilicovolcanoconiosis';
    assert.strictEqual(limitWords(text, 1), 'Supercalifragilisticexpialidocious...');
    assert.strictEqual(limitWords(text, 2), 'Supercalifragilisticexpialidocious Pneumonoultramicroscopicsilicovolcanoconiosis');
  });

  it('handles text with punctuation', () => {
    const text = 'Hello, world! How are you today? I hope you\'re doing well.';
    assert.strictEqual(limitWords(text, 4), 'Hello, world! How are...');
    assert.strictEqual(limitWords(text, 6), 'Hello, world! How are you today?...');
  });
});

describe('Get Includes', () => {
  it('returns an empty object for no includes', () => {
    const req = new PipelineRequest(new URL('https://example.com'));
    assert.deepStrictEqual(getIncludes(req), {});
  });

  it('returns an object with true for each include', () => {
    const req = new PipelineRequest(new URL('https://example.com?include=foo,bar'));
    assert.deepStrictEqual(getIncludes(req), { foo: true, bar: true });
  });

  it('returns an object with true for each include', () => {
    const req = new PipelineRequest(new URL('https://example.com?include=foo&include=all'));
    assert.deepStrictEqual(getIncludes(req), { foo: true, all: true });
  });
});

describe('Get Pagination Params', () => {
  it('returns empty object when no pagination params present', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json'));
    assert.deepStrictEqual(getPaginationParams(req), {});
  });

  it('parses limit query param', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit=100'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true, limit: 100 });
  });

  it('parses offset query param', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?offset=50'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true, offset: 50 });
  });

  it('parses both limit and offset query params', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit=100&offset=200'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true, limit: 100, offset: 200 });
  });

  it('sets hasParams for invalid limit (non-numeric)', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit=abc'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true });
  });

  it('sets hasParams for invalid offset (non-numeric)', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?offset=xyz'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true });
  });

  it('sets hasParams for negative limit', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit=-10'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true });
  });

  it('sets hasParams for negative offset', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?offset=-5'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true });
  });

  it('handles zero limit', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit=0'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true, limit: 0 });
  });

  it('handles zero offset', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?offset=0'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true, offset: 0 });
  });

  it('handles floating point numbers (floors them)', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit=10.7&offset=5.3'));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true, limit: 10, offset: 5 });
  });

  it('sets hasParams for empty limit value', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?limit='));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true });
  });

  it('sets hasParams for empty offset value', () => {
    const req = new PipelineRequest(new URL('https://example.com/index.json?offset='));
    assert.deepStrictEqual(getPaginationParams(req), { hasParams: true });
  });
});
