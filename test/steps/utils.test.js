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

import {
  getOriginalHost,
  stripHTML,
  maybeHTML,
  slugger,
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

describe('Slugger', () => {
  it('returns empty string for non-string inputs', () => {
    assert.strictEqual(slugger(null), '');
    assert.strictEqual(slugger(undefined), '');
    assert.strictEqual(slugger(123), '');
    assert.strictEqual(slugger({}), '');
    assert.strictEqual(slugger([]), '');
    assert.strictEqual(slugger(true), '');
    assert.strictEqual(slugger(false), '');
  });

  it('converts to lowercase', () => {
    assert.strictEqual(slugger('HELLO'), 'hello');
    assert.strictEqual(slugger('Hello World'), 'hello-world');
    assert.strictEqual(slugger('MIXED Case'), 'mixed-case');
    assert.strictEqual(slugger('UPPERCASE'), 'uppercase');
  });

  it('replaces spaces with hyphens', () => {
    assert.strictEqual(slugger('hello world'), 'hello-world');
    assert.strictEqual(slugger('hello  world'), 'hello-world');
    assert.strictEqual(slugger('hello   world'), 'hello-world');
    assert.strictEqual(slugger('hello\tworld'), 'hello-world');
    assert.strictEqual(slugger('hello\nworld'), 'hello-world');
    assert.strictEqual(slugger('hello\r\nworld'), 'hello-world');
  });

  it('removes forward slashes', () => {
    assert.strictEqual(slugger('hello/world'), 'hello-world');
    assert.strictEqual(slugger('hello/world/test'), 'hello-world-test');
    assert.strictEqual(slugger('/hello/world/'), 'hello-world');
    assert.strictEqual(slugger('hello//world'), 'hello-world');
  });

  it('removes leading and trailing hyphens', () => {
    assert.strictEqual(slugger('-hello-'), 'hello');
    assert.strictEqual(slugger('--hello--'), 'hello');
    assert.strictEqual(slugger('---hello---'), 'hello');
    assert.strictEqual(slugger('-hello world-'), 'hello-world');
    assert.strictEqual(slugger('--hello world--'), 'hello-world');
  });

  it('handles complex SKUs with multiple transformations', () => {
    assert.strictEqual(slugger('Product Name 123'), 'product-name-123');
    assert.strictEqual(slugger('SKU-ABC-123'), 'sku-abc-123');
    assert.strictEqual(slugger('Product/Name/With/Slashes'), 'product-name-with-slashes');
    assert.strictEqual(slugger('  Product Name  '), 'product-name');
    assert.strictEqual(slugger('-Product-Name-'), 'product-name');
    assert.strictEqual(slugger('Product/Name/'), 'product-name');
  });

  it('handles edge cases', () => {
    assert.strictEqual(slugger(''), '');
    assert.strictEqual(slugger('   '), '');
    assert.strictEqual(slugger('---'), '');
    assert.strictEqual(slugger('///'), '');
    assert.strictEqual(slugger('   ---   '), '');
    assert.strictEqual(slugger('a'), 'a');
    assert.strictEqual(slugger('A'), 'a');
    assert.strictEqual(slugger('1'), '1');
  });

  it('handles special characters', () => {
    assert.strictEqual(slugger('hello@world'), 'helloworld');
    assert.strictEqual(slugger('hello#world'), 'helloworld');
    assert.strictEqual(slugger('hello$world'), 'helloworld');
    assert.strictEqual(slugger('hello%world'), 'helloworld');
    assert.strictEqual(slugger('hello^world'), 'helloworld');
    assert.strictEqual(slugger('hello&world'), 'helloworld');
    assert.strictEqual(slugger('hello*world'), 'helloworld');
    assert.strictEqual(slugger('hello(world)'), 'helloworld');
    assert.strictEqual(slugger('hello[world]'), 'helloworld');
    assert.strictEqual(slugger('hello{world}'), 'helloworld');
  });

  it('handles numbers and mixed content', () => {
    assert.strictEqual(slugger('123'), '123');
    assert.strictEqual(slugger('Product 123'), 'product-123');
    assert.strictEqual(slugger('123 Product'), '123-product');
    assert.strictEqual(slugger('Product-123'), 'product-123');
    assert.strictEqual(slugger('Product_123'), 'product-123');
  });

  it('handles multiple consecutive transformations', () => {
    assert.strictEqual(slugger('  Product / Name / 123  '), 'product-name-123');
    assert.strictEqual(slugger('---Product---Name---'), 'product-name');
    assert.strictEqual(slugger('///Product///Name///'), 'product-name');
    assert.strictEqual(slugger('   /   Product   /   Name   /   '), 'product-name');
  });
});
