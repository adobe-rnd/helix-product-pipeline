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
import { formatPrice } from '../../src/steps/render-body.js';

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

    it('displays regular price when final is empty string', () => {
      const result = formatPrice({ final: '', regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$99.99');
    });

    it('displays regular price when final is undefined', () => {
      const result = formatPrice({ final: undefined, regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$99.99');
    });

    it('displays regular price when final is undefined', () => {
      const result = formatPrice({ final: null, regular: '99.99' });
      assert.strictEqual(result.tagName, 'p');
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].value, '$99.99');
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
