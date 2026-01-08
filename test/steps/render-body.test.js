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
import { formatPrice, rewriteContentImageUrls } from '../../src/steps/render-body.js';

describe('formatPrice', () => {
  describe('null and empty cases', () => {
    it('returns empty string for null price', () => {
      assert.strictEqual(formatPrice(null), '');
    });

    it('returns empty string for undefined price', () => {
      assert.strictEqual(formatPrice(undefined), '');
    });

    it('returns paragraph with undefined for empty object', () => {
      // Empty object has no final/regular properties, so final/regular are undefined
      const result = formatPrice({});
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children[0].value, '$undefined');
    });
  });

  describe('regular price (no sale)', () => {
    it('displays regular price when final equals regular', () => {
      const result = formatPrice({ final: '99.99', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$99.99');
    });

    it('displays final price when final is greater than regular', () => {
      const result = formatPrice({ final: '129.99', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$129.99');
    });

    it('displays regular price with zero values', () => {
      const result = formatPrice({ final: '0', regular: '0' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$0');
    });
  });

  describe('sale price', () => {
    it('displays sale price when final is less than regular', () => {
      const result = formatPrice({ final: '79.99', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$79.99 ');
      assert.strictEqual(result.children[1].value, '(');
      assert.strictEqual(result.children[2].tagName, 'del');
      assert.strictEqual(result.children[2].children[0].value, '$99.99');
      assert.strictEqual(result.children[3].value, ')');
    });

    it('correctly compares numeric values as numbers not strings', () => {
      // "9" > "100" alphabetically, but 9 < 100 numerically
      const result = formatPrice({ final: '9.99', regular: '100.00' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$9.99 ');
      assert.strictEqual(result.children[2].children[0].value, '$100.00');
    });

    it('handles prices with many decimal places', () => {
      const result = formatPrice({ final: '99.999', regular: '100.001' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$99.999 ');
    });

    it('handles integer prices without decimals', () => {
      const result = formatPrice({ final: '50', regular: '100' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$50 ');
      assert.strictEqual(result.children[2].children[0].value, '$100');
    });
  });

  describe('string to number conversion edge cases', () => {
    it('handles prices with leading zeros', () => {
      const result = formatPrice({ final: '099.99', regular: '100.00' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$099.99 ');
    });

    it('handles prices with whitespace', () => {
      const result = formatPrice({ final: ' 79.99 ', regular: ' 99.99 ' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$ 79.99  ');
    });

    it('handles very small price differences', () => {
      const result = formatPrice({ final: '99.98', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$99.98 ');
    });

    it('handles large price values', () => {
      const result = formatPrice({ final: '999999.99', regular: '1000000.00' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$999999.99 ');
    });
  });

  describe('invalid/NaN cases', () => {
    it('displays final price when final is NaN', () => {
      const result = formatPrice({ final: 'invalid', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$invalid');
    });

    it('displays final price when regular is NaN', () => {
      const result = formatPrice({ final: '79.99', regular: 'invalid' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$79.99');
    });

    it('displays final price when both are NaN', () => {
      const result = formatPrice({ final: 'N/A', regular: 'N/A' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$N/A');
    });

    it('displays final price when final is empty string', () => {
      const result = formatPrice({ final: '', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$');
    });

    it('displays final price when regular is undefined', () => {
      const result = formatPrice({ final: '79.99', regular: undefined });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$79.99');
    });

    it('displays final price when regular is null', () => {
      const result = formatPrice({ final: '79.99', regular: null });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$79.99');
    });

    it('handles partial numeric strings', () => {
      const result = formatPrice({ final: '79.99abc', regular: '99.99' });
      // parseFloat('79.99abc') = 79.99, parseFloat('99.99') = 99.99
      // 79.99 < 99.99, so should show sale format
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$79.99abc ');
    });
  });

  describe('edge cases with zero', () => {
    it('does not show sale format when final is 0 and regular is 0', () => {
      const result = formatPrice({ final: '0', regular: '0' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
    });

    it('shows sale format when final is 0 and regular is positive', () => {
      const result = formatPrice({ final: '0', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$0 ');
    });

    it('shows sale format when final is more negative than regular', () => {
      // -10 < -5 numerically, so this shows as sale format
      const result = formatPrice({ final: '-10', regular: '-5' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
      assert.strictEqual(result.children[0].value, '$-10 ');
      assert.strictEqual(result.children[2].children[0].value, '$-5');
    });

    it('shows sale format when final is negative and regular is positive', () => {
      const result = formatPrice({ final: '-10', regular: '5' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 4);
    });
  });
});

describe('rewriteContentImageUrls', () => {
  describe('basic img src rewriting', () => {
    it('rewrites simple img src with media_ prefix', () => {
      const html = '<img src="./path/to/media_abc123.jpg" alt="test">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./path/to/content-images/media_abc123.jpg" alt="test">');
    });

    it('rewrites img src with double quotes', () => {
      const html = '<img src="./images/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./images/content-images/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif">');
    });

    it('rewrites img src with single quotes', () => {
      const html = "<img src='./assets/media_test.png'>";
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, "<img src='./assets/content-images/media_test.png'>");
    });

    it('rewrites nested path img src', () => {
      const html = '<img src="./products/gallery/media_xyz.webp" alt="Product">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./products/gallery/content-images/media_xyz.webp" alt="Product">');
    });

    it('rewrites relative paths with query parameters', () => {
      const html = '<img src="./content/media_1e34827d47552143150804dd7663928c2b4b88bbf.jpg?width=2000&format=webply&optimize=medium">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./content/content-images/media_1e34827d47552143150804dd7663928c2b4b88bbf.jpg?width=2000&format=webply&optimize=medium">');
    });

    it('rewrites absolute paths', () => {
      const html = '<img src="/services/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="/services/content-images/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif">');
    });

    it('rewrites parent relative paths', () => {
      const html = '<img src="../media_test.jpg">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="../content-images/media_test.jpg">');
    });
  });

  describe('multiple images', () => {
    it('rewrites multiple img tags in same content', () => {
      const html = `
        <img src="./gallery/media_1.jpg">
        <img src="./gallery/media_2.png">
        <img src="./gallery/media_3.webp">
      `;
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./gallery/content-images/media_1.jpg'));
      assert.ok(result.includes('./gallery/content-images/media_2.png'));
      assert.ok(result.includes('./gallery/content-images/media_3.webp'));
    });

    it('rewrites images with mixed path styles', () => {
      const html = `
        <div>
          <img src="./images/hero/media_a.jpg">
          <div>
            <img src="./images/thumbnails/media_b.jpg">
          </div>
        </div>
      `;
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./images/hero/content-images/media_a.jpg'));
      assert.ok(result.includes('./images/thumbnails/content-images/media_b.jpg'));
    });
  });

  describe('different image formats', () => {
    it('rewrites .jpg images', () => {
      const html = '<img src="./products/media_image.jpg">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./products/content-images/media_image.jpg'));
    });

    it('rewrites .jpeg images', () => {
      const html = '<img src="./assets/images/media_image.jpeg">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./assets/images/content-images/media_image.jpeg'));
    });

    it('rewrites .png images', () => {
      const html = '<img src="./content/media_image.png">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./content/content-images/media_image.png'));
    });

    it('rewrites .webp images', () => {
      const html = '<img src="./gallery/photos/media_image.webp">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./gallery/photos/content-images/media_image.webp'));
    });

    it('rewrites .avif images', () => {
      const html = '<img src="./images/media_image.avif">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./images/content-images/media_image.avif'));
    });

    it('rewrites .gif images', () => {
      const html = '<img src="./animations/media_image.gif">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./animations/content-images/media_image.gif'));
    });

    it('rewrites .svg images', () => {
      const html = '<img src="./icons/media_image.svg">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./icons/content-images/media_image.svg'));
    });
  });

  describe('query parameters', () => {
    it('rewrites images with query parameters', () => {
      const html = '<img src="./products/images/media_image.jpg?width=500&format=webp">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./products/images/content-images/media_image.jpg?width=500&format=webp">');
    });

    it('rewrites images with single query parameter', () => {
      const html = '<img src="./gallery/media_image.avif?width=2000">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./gallery/content-images/media_image.avif?width=2000">');
    });

    it('rewrites images with complex query strings', () => {
      const html = '<img src="./assets/photos/media_test.jpg?width=2000&format=webply&optimize=medium">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./assets/photos/content-images/media_test.jpg?width=2000&format=webply&optimize=medium">');
    });
  });

  describe('source tag srcset', () => {
    it('rewrites source srcset attribute', () => {
      const html = '<source srcset="./images/responsive/media_image.webp" type="image/webp">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<source srcset="./images/responsive/content-images/media_image.webp" type="image/webp">');
    });

    it('rewrites source srcset with single quotes', () => {
      const html = "<source srcset='./products/media_image.jpg'>";
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, "<source srcset='./products/content-images/media_image.jpg'>");
    });

    it('rewrites multiple source tags', () => {
      const html = `
        <picture>
          <source srcset="./gallery/hero/media_img.avif" type="image/avif">
          <source srcset="./gallery/hero/media_img.webp" type="image/webp">
        </picture>
      `;
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./gallery/hero/content-images/media_img.avif'));
      assert.ok(result.includes('./gallery/hero/content-images/media_img.webp'));
    });
  });

  describe('picture element', () => {
    it('rewrites img and source tags inside picture element', () => {
      const html = `
        <picture>
          <source srcset="./products/images/media_img.avif" type="image/avif">
          <source srcset="./products/images/media_img.webp" type="image/webp">
          <img src="./products/images/media_img.jpg" alt="Product">
        </picture>
      `;
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./products/images/content-images/media_img.avif'));
      assert.ok(result.includes('./products/images/content-images/media_img.webp'));
      assert.ok(result.includes('./products/images/content-images/media_img.jpg'));
    });
  });

  describe('images that should NOT be rewritten', () => {
    it('does not rewrite images without media_ prefix', () => {
      const html = '<img src="./path/to/regular-image.jpg">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, html);
    });

    it('does not rewrite data URIs', () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgo...">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, html);
    });

    it('does not rewrite images at root without slash before media_', () => {
      const html = '<img src="media_nopath.jpg">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, html);
    });
  });

  describe('case sensitivity', () => {
    it('handles uppercase IMG tag', () => {
      const html = '<IMG SRC="./path/to/media_test.jpg">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<IMG SRC="./path/to/content-images/media_test.jpg">');
    });

    it('handles mixed case attributes', () => {
      const html = '<img SrC="./media_test.jpg">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img SrC="./content-images/media_test.jpg">');
    });

    it('handles uppercase SOURCE tag', () => {
      const html = '<SOURCE SRCSET="./path/media_test.webp">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<SOURCE SRCSET="./path/content-images/media_test.webp">');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = rewriteContentImageUrls('');
      assert.strictEqual(result, '');
    });

    it('handles HTML with no images', () => {
      const html = '<div><p>Some text content</p></div>';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, html);
    });

    it('handles img tag with multiple attributes', () => {
      const html = '<img class="product-image" data-id="123" src="./path/to/media_test.jpg" alt="Test" loading="lazy">';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./path/to/content-images/media_test.jpg'));
      assert.ok(result.includes('class="product-image"'));
      assert.ok(result.includes('loading="lazy"'));
    });

    it('handles malformed HTML', () => {
      const html = '<img src="./path/media_test.jpg" alt="unclosed tag';
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./path/content-images/media_test.jpg'));
    });

    it('preserves HTML structure', () => {
      const html = `
        <div class="content">
          <h1>Product Title</h1>
          <img src="./products/images/media_hero.jpg" alt="Hero">
          <p>Description text</p>
          <img src="./products/images/media_detail.jpg" alt="Detail">
        </div>
      `;
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('<h1>Product Title</h1>'));
      assert.ok(result.includes('<p>Description text</p>'));
      assert.ok(result.includes('./products/images/content-images/media_hero.jpg'));
      assert.ok(result.includes('./products/images/content-images/media_detail.jpg'));
    });

    it('handles media_ in middle of filename', () => {
      const html = '<img src="./path/to/images/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(result, '<img src="./path/to/images/content-images/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif">');
    });

    it('handles multiple media_ prefixes in path', () => {
      const html = '<img src="./media_folder/subfolder/media_image.jpg">';
      const result = rewriteContentImageUrls(html);
      // Simple regex replaces all /media_ occurrences (folder names and filenames)
      assert.strictEqual(result, '<img src="./content-images/media_folder/subfolder/content-images/media_image.jpg">');
    });
  });

  describe('real-world examples', () => {
    it('handles example from Agilent services page', () => {
      const html = '<img src="./en/services/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif?width=2000&format=webply&optimize=medium">';
      const result = rewriteContentImageUrls(html);
      assert.strictEqual(
        result,
        '<img src="./en/services/content-images/media_165855a22ff2f69475d72b51b008b10ba21f73364.avif?width=2000&format=webply&optimize=medium">',
      );
    });

    it('handles rich product content with multiple images', () => {
      const html = `
        <div class="product-details">
          <picture>
            <source srcset="./products/hero/media_hero.avif?width=1200" type="image/avif">
            <source srcset="./products/hero/media_hero.webp?width=1200" type="image/webp">
            <img src="./products/hero/media_hero.jpg?width=1200" alt="Product Hero">
          </picture>
          <div class="gallery">
            <img src="./products/gallery/media_gallery1_thumb.jpg" alt="Gallery 1">
            <img src="./products/gallery/media_gallery2_thumb.jpg" alt="Gallery 2">
          </div>
        </div>
      `;
      const result = rewriteContentImageUrls(html);
      assert.ok(result.includes('./products/hero/content-images/media_hero.avif'));
      assert.ok(result.includes('./products/hero/content-images/media_hero.webp'));
      assert.ok(result.includes('./products/hero/content-images/media_hero.jpg'));
      assert.ok(result.includes('./products/gallery/content-images/media_gallery1_thumb.jpg'));
      assert.ok(result.includes('./products/gallery/content-images/media_gallery2_thumb.jpg'));
    });
  });
});
