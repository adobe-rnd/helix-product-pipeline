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

  describe('rewriteContentImageUrls', () => {
    describe('basic img src rewriting', () => {
      it('rewrites simple img src with media_ prefix', () => {
        const html = '<img src="./path/to/media_abc123def456789012345678901234567890abcd.jpg" alt="test">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="./path/to/content-images/media_abc123def456789012345678901234567890abcd.jpg" alt="test">');
      });

      it('rewrites nested path img src', () => {
        const html = '<img src="./products/gallery/media_11fa1411c77cbc54df349acdf818c84519d82750.webp" alt="Product">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="./products/gallery/content-images/media_11fa1411c77cbc54df349acdf818c84519d82750.webp" alt="Product">');
      });

      it('rewrites relative paths with query parameters', () => {
        const html = '<img src="./content/media_1e34827d47552143150804dd7663928c2b4b88bf.jpg?width=2000&format=webply&optimize=medium">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="./content/content-images/media_1e34827d47552143150804dd7663928c2b4b88bf.jpg?width=2000&format=webply&optimize=medium">');
      });

      it('rewrites absolute paths', () => {
        const html = '<img src="/services/media_165855a22ff2f69475d72b51b008b10ba21f7336.avif">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="/services/content-images/media_165855a22ff2f69475d72b51b008b10ba21f7336.avif">');
      });

      it('rewrites parent relative paths', () => {
        const html = '<img src="../media_abcdef1234567890abcdef1234567890abcdef12.jpg">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="../content-images/media_abcdef1234567890abcdef1234567890abcdef12.jpg">');
      });
    });

    describe('multiple images', () => {
      it('rewrites multiple img tags in same content', () => {
        const html = `
          <img src="./gallery/media_1234567890abcdef1234567890abcdef12345678.jpg">
          <img src="./gallery/media_234567890abcdef1234567890abcdef123456789.png">
          <img src="./gallery/media_34567890abcdef1234567890abcdef1234567890.webp">
        `;
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./gallery/content-images/media_1234567890abcdef1234567890abcdef12345678.jpg'));
        assert.ok(result.includes('./gallery/content-images/media_234567890abcdef1234567890abcdef123456789.png'));
        assert.ok(result.includes('./gallery/content-images/media_34567890abcdef1234567890abcdef1234567890.webp'));
      });

      it('rewrites images with mixed path styles', () => {
        const html = `
          <div>
            <img src="./images/hero/media_abcd1234567890abcdef1234567890abcdef1234.jpg">
            <div>
              <img src="./images/thumbnails/media_bcde234567890abcdef1234567890abcdef12345.jpg">
            </div>
          </div>
        `;
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./images/hero/content-images/media_abcd1234567890abcdef1234567890abcdef1234.jpg'));
        assert.ok(result.includes('./images/thumbnails/content-images/media_bcde234567890abcdef1234567890abcdef12345.jpg'));
      });
    });

    describe('different image formats', () => {
      it('rewrites .jpg images', () => {
        const html = '<img src="./products/media_11fa1411c77cbc54df349acdf818c84519d82750.jpg">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./products/content-images/media_11fa1411c77cbc54df349acdf818c84519d82750.jpg'));
      });

      it('rewrites .jpeg images', () => {
        const html = '<img src="./assets/images/media_22fb2522d88dcd65ef45abdef929d95629e93861.jpeg">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./assets/images/content-images/media_22fb2522d88dcd65ef45abdef929d95629e93861.jpeg'));
      });

      it('rewrites .png images', () => {
        const html = '<img src="./content/media_33fc3633e99ede76ff56bceff03aea663af04972.png">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./content/content-images/media_33fc3633e99ede76ff56bceff03aea663af04972.png'));
      });

      it('rewrites .webp images', () => {
        const html = '<img src="./gallery/photos/media_44fd4744faafef87ff67cdeff14bfb774bf15a83.webp">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./gallery/photos/content-images/media_44fd4744faafef87ff67cdeff14bfb774bf15a83.webp'));
      });

      it('rewrites .avif images', () => {
        const html = '<img src="./images/media_55fe5855fbbfff98ff78deff025cfc885cf26b94.avif">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./images/content-images/media_55fe5855fbbfff98ff78deff025cfc885cf26b94.avif'));
      });

      it('rewrites .gif images', () => {
        const html = '<img src="./animations/media_66ff6966fcccffa9ff89efff136dfd996df37ca5.gif">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./animations/content-images/media_66ff6966fcccffa9ff89efff136dfd996df37ca5.gif'));
      });

      it('rewrites .svg images', () => {
        const html = '<img src="./icons/media_77ff7a77fddfffbaff9afeff247efea97ef48db6.svg">';
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./icons/content-images/media_77ff7a77fddfffbaff9afeff247efea97ef48db6.svg'));
      });
    });

    describe('query parameters', () => {
      it('rewrites images with query parameters', () => {
        const html = '<img src="./products/images/media_88ff8b88feeefffcffabfeff358fffba98ff59ec7.jpg?width=500&format=webp">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="./products/images/content-images/media_88ff8b88feeefffcffabfeff358fffba98ff59ec7.jpg?width=500&format=webp">');
      });

      it('rewrites images with single query parameter', () => {
        const html = '<img src="./gallery/media_99ff9c99ffffffdffbcfeff469fffcba9aff6afd8.avif?width=2000">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="./gallery/content-images/media_99ff9c99ffffffdffbcfeff469fffcba9aff6afd8.avif?width=2000">');
      });

      it('rewrites images with complex query strings', () => {
        const html = '<img src="./assets/photos/media_aaffadaaffffffeffcdfeff57afffdbaabaff7bfe9.jpg?width=2000&format=webply&optimize=medium">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<img src="./assets/photos/content-images/media_aaffadaaffffffeffcdfeff57afffdbaabaff7bfe9.jpg?width=2000&format=webply&optimize=medium">');
      });
    });

    describe('source tag srcset', () => {
      it('rewrites source srcset attribute', () => {
        const html = '<source srcset="./images/responsive/media_bbffbebbffffffffffffffeff68afffecbacbff8cfa.webp" type="image/webp">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, '<source srcset="./images/responsive/content-images/media_bbffbebbffffffffffffffeff68afffecbacbff8cfa.webp" type="image/webp">');
      });

      it('rewrites source srcset with single quotes', () => {
        const html = "<source srcset='./products/media_ccffcfccffffffffffffffeff79bffffdcbdcff9dfb.jpg'>";
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, "<source srcset='./products/content-images/media_ccffcfccffffffffffffffeff79bffffdcbdcff9dfb.jpg'>");
      });

      it('rewrites multiple source tags', () => {
        const html = `
          <picture>
            <source srcset="./gallery/hero/media_ddffddddffffffffffffffeff8acffffedbedffaefc.avif" type="image/avif">
            <source srcset="./gallery/hero/media_eeffeeeeffffffffffffffeff9bdfffffebeeffbffd.webp" type="image/webp">
          </picture>
        `;
        const result = rewriteContentImageUrls(html);
        assert.ok(result.includes('./gallery/hero/content-images/media_ddffddddffffffffffffffeff8acffffedbedffaefc.avif'));
        assert.ok(result.includes('./gallery/hero/content-images/media_eeffeeeeffffffffffffffeff9bdfffffebeeffbffd.webp'));
      });
    });

    describe('edge cases - should NOT rewrite', () => {
      it('does not rewrite directory names with media_ prefix', () => {
        const html = '<img src="/media_folder/image.jpg" alt="Directory">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, html, 'Directory names should not be rewritten');
      });

      it('does not rewrite non-hex filenames', () => {
        const html = '<img src="./assets/media_description_file.png" alt="Non-hex">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, html, 'Non-hex filenames should not be rewritten');
      });

      it('does not rewrite filenames with mixed alphanumeric characters', () => {
        const html = '<img src="./images/media_abc123xyz.jpg" alt="Mixed chars">';
        const result = rewriteContentImageUrls(html);
        assert.strictEqual(result, html, 'Mixed alphanumeric filenames should not be rewritten');
      });
    });
  });
});
