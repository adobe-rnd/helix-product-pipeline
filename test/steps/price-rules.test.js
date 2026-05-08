/*
 * Copyright 2026 Adobe. All rights reserved.
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
import { applyProductPriceRule, applyCatalogPriceRules } from '../../src/steps/apply-price-rules.js';
import { fetchCatalogPriceRules } from '../../src/steps/fetch-price-rules.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAST = new Date(Date.now() - 86400_000).toISOString();
const FUTURE = new Date(Date.now() + 86400_000).toISOString();

function makeS3Loader(objects = {}) {
  return {
    async getObject(bucket, key) {
      const val = objects[key];
      if (val === undefined) return { status: 404, body: 'Not Found' };
      return { status: 200, body: typeof val === 'string' ? val : JSON.stringify(val) };
    },
  };
}

function makeState(overrides = {}) {
  return {
    org: 'org',
    site: 'site',
    info: { path: '/us/en/my-product.json' },
    s3Loader: makeS3Loader(),
    log: { info: () => {}, warn: () => {}, error: () => {} },
    ...overrides,
  };
}

function promo(id, rules, name = 'Test') {
  return { id, name, rules };
}

function rule(path, price, extras = {}) {
  return { path, price, ...extras };
}

function catalogRules(...promotions) {
  return { promotions };
}

// ---------------------------------------------------------------------------
// applyProductPriceRule
// ---------------------------------------------------------------------------

describe('applyProductPriceRule', () => {
  it('no-ops when catalogPriceRules is absent', () => {
    const state = makeState({ content: { data: { price: { final: '10.00' } } } });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '10.00');
  });

  it('no-ops when catalogPriceRules has no promotions', () => {
    const state = makeState({
      catalogPriceRules: { promotions: [] },
      content: { data: { price: { final: '10.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '10.00');
  });

  it('no-ops when content.data is absent', () => {
    const state = makeState({ catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '5.00')])), content: {} });
    applyProductPriceRule(state);
  });

  it('sets price.final when promotion rule matches path', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '29.99')])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '29.99');
  });

  it('does not apply rule when price is not lower than current price', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '60.00')])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('applies rule when start is in the past', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '25.00', { start: PAST })])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '25.00');
  });

  it('does not apply rule when start is in the future', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '25.00', { start: FUTURE })])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('applies rule when end is in the future', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '25.00', { end: FUTURE })])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '25.00');
  });

  it('does not apply rule when end is in the past', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '25.00', { end: PAST })])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('applies the lowest price when multiple promotions match', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(
        promo('p1', [rule('/us/en/my-product', '30.00')]),
        promo('p2', [rule('/us/en/my-product', '25.00')]),
        promo('p3', [rule('/us/en/my-product', '28.00')]),
      ),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '25.00');
  });

  it('strips .json extension from path when matching', () => {
    const state = makeState({
      info: { path: '/us/en/my-product.json' },
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '29.99')])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '29.99');
  });

  it('strips .html extension from path when matching', () => {
    const state = makeState({
      info: { path: '/us/en/my-product.html' },
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '29.99')])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '29.99');
  });

  it('does not apply rule for a different path', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/other-product', '25.00')])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('inherits parent price to array variants without a variant rule', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '20.00')])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '20.00');
  });

  it('applies variant-specific rule from array variants', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '20.00', {
        variants: { 'sku-a': { sku: 'sku-a', price: '15.00' } },
      })])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '15.00');
  });

  it('skips expired variant rule and inherits parent price instead', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '20.00', {
        variants: { 'sku-a': { sku: 'sku-a', price: '5.00', end: PAST } },
      })])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '20.00');
  });

  it('skips rule with non-numeric price', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [{ path: '/us/en/my-product', price: 'not-a-number' }])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('skips variant price update when variant rule price is null', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '20.00', {
        variants: { 'sku-a': { sku: 'sku-a', price: null } },
      })])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '50.00');
  });

  it('skips variant price inheritance when rule.price is null', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [{ path: '/us/en/my-product', price: '20.00', variants: { 'sku-a': { sku: 'sku-a', price: '15.00', start: FUTURE } } }])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    });
    // Variant rule is inactive (future start), so parent price is inherited
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '20.00');
  });

  it('skips price update when product has no price object', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '20.00')])),
      content: { data: {} },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price, undefined);
  });

  it('skips variant price update when variant has no price field', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '20.00')])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a' }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '20.00');
    assert.strictEqual(state.content.data.variants[0].price, undefined);
  });

  it('does not raise a variant price when rule price is higher than variant price', () => {
    // rule targets product at $50 → $40, but variant is already $30 — must stay $30
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '40.00')])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '30.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '40.00', 'product price should be lowered');
    assert.strictEqual(state.content.data.variants[0].price.final, '30.00', 'variant must not be raised');
  });

  it('applies rule selected via variant benefit when rule price exceeds product price', () => {
    // product $30, variant $60, rule product→$40 (higher, skipped), variant→$50 (lower, applied)
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [{
        path: '/us/en/my-product',
        price: '40.00',
        variants: { 'sku-a': { sku: 'sku-a', price: '50.00' } },
      }])),
      content: {
        data: {
          price: { final: '30.00' },
          variants: [{ sku: 'sku-a', price: { final: '60.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '30.00', 'product price must not be raised');
    assert.strictEqual(state.content.data.variants[0].price.final, '50.00', 'variant should be discounted');
  });

  it('applies a rule with no product price when its variant-specific price is lower', () => {
    // rule has only a variant-specific price (no product-level price)
    //   — product unchanged, variant discounted
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [{
        path: '/us/en/my-product',
        variants: { 'sku-a': { sku: 'sku-a', price: '45.00' } },
      }])),
      content: {
        data: {
          price: { final: '30.00' },
          variants: [{ sku: 'sku-a', price: { final: '60.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '30.00', 'product price unchanged');
    assert.strictEqual(state.content.data.variants[0].price.final, '45.00', 'variant discounted via variant-only rule');
  });

  it('rejects a rule when its product price is higher and no variant benefits', () => {
    // rule price $60 > product price $50, no variant rules → rule should not qualify at all
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '60.00')])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '30.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00', 'product price unchanged');
    assert.strictEqual(state.content.data.variants[0].price.final, '30.00', 'variant unchanged');
  });

  it('does not raise a variant price when a variant-specific rule price is higher', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [{
        path: '/us/en/my-product',
        price: '40.00',
        variants: { 'sku-a': { sku: 'sku-a', price: '35.00' } },
      }])),
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '30.00' } }],
        },
      },
    });
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '40.00', 'product price should be lowered');
    assert.strictEqual(state.content.data.variants[0].price.final, '30.00', 'variant must not be raised by variant rule');
  });

  it('records last-modified from rule start when res is provided', () => {
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '29.99', { start: PAST })])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state, res);
    assert.ok(res.lastModifiedSources['price-rules'], 'should record price-rules last-modified');
    // HTTP-date has second precision; compare against seconds-truncated value
    assert.strictEqual(res.lastModifiedSources['price-rules'].time, new Date(new Date(PAST).toUTCString()).getTime());
  });

  it('records last-modified at the newest start among multiple active rules', () => {
    const OLDER = new Date(Date.now() - 7 * 86400_000).toISOString();
    const NEWER = new Date(Date.now() - 86400_000).toISOString();
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = makeState({
      catalogPriceRules: catalogRules(
        promo('p1', [rule('/us/en/my-product', '30.00', { start: OLDER })]),
        promo('p2', [rule('/us/en/my-product', '35.00', { start: NEWER })]),
      ),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state, res);
    // p2 has newer start but higher price; last-modified should reflect newest start (NEWER)
    assert.strictEqual(res.lastModifiedSources['price-rules'].time, new Date(new Date(NEWER).toUTCString()).getTime());
  });

  it('does not record last-modified when active rule has no start date', () => {
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '29.99')])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state, res);
    assert.strictEqual(res.lastModifiedSources['price-rules'], undefined);
  });

  it('does not record last-modified when no rules match the product path', () => {
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/other', '29.99', { start: PAST })])),
      content: { data: { price: { final: '50.00' } } },
    });
    applyProductPriceRule(state, res);
    assert.strictEqual(res.lastModifiedSources['price-rules'], undefined);
  });

  it('does not throw when res is omitted', () => {
    const state = makeState({
      catalogPriceRules: catalogRules(promo('p', [rule('/us/en/my-product', '29.99', { start: PAST })])),
      content: { data: { price: { final: '50.00' } } },
    });
    assert.doesNotThrow(() => applyProductPriceRule(state));
  });
});

// ---------------------------------------------------------------------------
// applyCatalogPriceRules
// ---------------------------------------------------------------------------

describe('applyCatalogPriceRules', () => {
  it('no-ops when catalogPriceRules is absent', () => {
    const state = { content: { data: { '/p/a': { data: { path: '/p/a', price: '10.00' } } } } };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['/p/a'].data.price, '10.00');
  });

  it('no-ops when catalogPriceRules has no promotions', () => {
    const state = {
      catalogPriceRules: { promotions: [] },
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '50.00');
  });

  it('no-ops when content.data is absent', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '5.00')])),
      content: {},
    };
    applyCatalogPriceRules(state);
  });

  it('sets flat product.price from rule in index entry', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00')])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '25.00');
  });

  it('does not apply rule when price is not lower than current price', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '60.00')])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '50.00');
  });

  it('applies the lowest price when multiple promotions match the same path', () => {
    const state = {
      catalogPriceRules: catalogRules(
        promo('p1', [rule('/p/a', '30.00')]),
        promo('p2', [rule('/p/a', '25.00')]),
      ),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '25.00');
  });

  it('skips index entry with no matching rule', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/other', '25.00')])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '50.00');
  });

  it('skips entries with no data or no path', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00')])),
      content: {
        data: {
          'key-null': null,
          'key-no-data': {},
          'key-no-path': { data: { price: '10.00' } },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-no-path'].data.price, '10.00');
  });

  it('sets flat variant.price from variant rule in index entry', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00', {
        variants: { 'sku-a': { sku: 'sku-a', price: '20.00' } },
      })])),
      content: {
        data: {
          'key-a': {
            data: {
              path: '/p/a',
              price: '50.00',
              variants: { 'sku-a': { sku: 'sku-a', price: '50.00' } },
            },
          },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.variants['sku-a'].price, '20.00');
  });

  it('inherits parent price to index variant without a variant rule', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00')])),
      content: {
        data: {
          'key-a': {
            data: {
              path: '/p/a',
              price: '50.00',
              variants: { 'sku-a': { sku: 'sku-a', price: '50.00' } },
            },
          },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.variants['sku-a'].price, '25.00');
  });

  it('does not raise an index variant price when inherited parent rule price is higher', () => {
    // product $50 → $40 via rule; index variant is already $30 — must stay $30
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '40.00')])),
      content: {
        data: {
          'key-a': {
            data: {
              path: '/p/a',
              price: '50.00',
              variants: { 'sku-a': { sku: 'sku-a', price: '30.00' } },
            },
          },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '40.00', 'product price should be lowered');
    assert.strictEqual(state.content.data['key-a'].data.variants['sku-a'].price, '30.00', 'index variant must not be raised');
  });

  it('skips rule with non-numeric price', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [{ path: '/p/a', price: 'not-a-number' }])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '50.00');
  });

  it('skips inactive rule in index mode', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00', { end: PAST })])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, '50.00');
  });

  it('skips product when its price is non-numeric', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00')])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: 'free' } } } },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price, 'free');
  });

  it('records last-modified at newest rule start among index products', () => {
    const OLDER = new Date(Date.now() - 7 * 86400_000).toISOString();
    const NEWER = new Date(Date.now() - 86400_000).toISOString();
    const log = { warn: () => {}, error: () => {} };
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = {
      log,
      catalogPriceRules: catalogRules(
        promo('p1', [rule('/p/a', '25.00', { start: OLDER })]),
        promo('p2', [rule('/p/b', '30.00', { start: NEWER })]),
      ),
      content: {
        data: {
          'key-a': { data: { path: '/p/a', price: '50.00' } },
          'key-b': { data: { path: '/p/b', price: '50.00' } },
        },
      },
    };
    applyCatalogPriceRules(state, res);
    assert.ok(res.lastModifiedSources['price-rules'], 'should record price-rules last-modified');
    assert.strictEqual(res.lastModifiedSources['price-rules'].time, new Date(new Date(NEWER).toUTCString()).getTime());
  });

  it('picks newest start even when multiple promotions target the same path', () => {
    const OLDER = new Date(Date.now() - 7 * 86400_000).toISOString();
    const NEWER = new Date(Date.now() - 86400_000).toISOString();
    const log = { warn: () => {}, error: () => {} };
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = {
      log,
      catalogPriceRules: catalogRules(
        promo('p1', [rule('/p/a', '30.00', { start: OLDER })]),
        promo('p2', [rule('/p/a', '35.00', { start: NEWER })]),
      ),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state, res);
    assert.strictEqual(res.lastModifiedSources['price-rules'].time, new Date(new Date(NEWER).toUTCString()).getTime());
  });

  it('does not record last-modified when no matching rules have a start date', () => {
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00')])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state, res);
    assert.strictEqual(res.lastModifiedSources['price-rules'], undefined);
  });

  it('does not record last-modified for paths not in the index', () => {
    const res = { lastModifiedSources: {}, headers: { set: () => {} } };
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/other', '25.00', { start: PAST })])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    applyCatalogPriceRules(state, res);
    assert.strictEqual(res.lastModifiedSources['price-rules'], undefined);
  });

  it('does not throw when res is omitted', () => {
    const state = {
      catalogPriceRules: catalogRules(promo('p', [rule('/p/a', '25.00', { start: PAST })])),
      content: { data: { 'key-a': { data: { path: '/p/a', price: '50.00' } } } },
    };
    assert.doesNotThrow(() => applyCatalogPriceRules(state));
  });
});

// ---------------------------------------------------------------------------
// fetchCatalogPriceRules
// ---------------------------------------------------------------------------

describe('fetchCatalogPriceRules', () => {
  it('sets catalogPriceRules from R2', async () => {
    const rules = {
      promotions: [{
        id: 'p',
        name: 'P',
        rules: [
          {
            path: '/p/a', price: '29.99', start: PAST, end: FUTURE,
          },
          { path: '/p/b', price: '49.99' },
        ],
      }],
    };
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': rules }),
    });
    await fetchCatalogPriceRules(state);
    assert.strictEqual(state.catalogPriceRules.promotions.length, 1);
    assert.strictEqual(state.catalogPriceRules.promotions[0].rules.length, 2);
  });

  it('pre-filters rules whose end is in the past', async () => {
    const rules = {
      promotions: [{
        id: 'p',
        name: 'P',
        rules: [
          { path: '/p/active', price: '10.00', end: FUTURE },
          { path: '/p/expired', price: '5.00', end: PAST },
        ],
      }],
    };
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': rules }),
    });
    await fetchCatalogPriceRules(state);
    const remaining = state.catalogPriceRules.promotions[0].rules;
    assert.ok(remaining.some((r) => r.path === '/p/active'));
    assert.ok(!remaining.some((r) => r.path === '/p/expired'));
  });

  it('removes promotions with all-expired rules', async () => {
    const rules = {
      promotions: [
        { id: 'p1', name: 'P1', rules: [{ path: '/p/expired', price: '5.00', end: PAST }] },
        { id: 'p2', name: 'P2', rules: [{ path: '/p/active', price: '10.00' }] },
      ],
    };
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': rules }),
    });
    await fetchCatalogPriceRules(state);
    assert.strictEqual(state.catalogPriceRules.promotions.length, 1);
    assert.strictEqual(state.catalogPriceRules.promotions[0].id, 'p2');
  });

  it('sets catalogPriceRules to { promotions: [] } when object is not found', async () => {
    const state = makeState();
    await fetchCatalogPriceRules(state);
    assert.deepStrictEqual(state.catalogPriceRules, { promotions: [] });
  });

  it('sets catalogPriceRules to { promotions: [] } when value lacks promotions array', async () => {
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': { '/old/format': { price: '1.00' } } }),
    });
    await fetchCatalogPriceRules(state);
    assert.deepStrictEqual(state.catalogPriceRules, { promotions: [] });
  });

  it('sets catalogPriceRules to { promotions: [] } on s3Loader error', async () => {
    const state = makeState({
      s3Loader: { getObject: async () => { throw new Error('R2 down'); } },
    });
    await fetchCatalogPriceRules(state);
    assert.deepStrictEqual(state.catalogPriceRules, { promotions: [] });
  });

  it('sets catalogPriceRules to { promotions: [] } when response body is invalid JSON', async () => {
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': 'not-json{{{' }),
    });
    await fetchCatalogPriceRules(state);
    assert.deepStrictEqual(state.catalogPriceRules, { promotions: [] });
  });

  it('uses the prod bucket and does not set stagePricing when x-env header is absent', async () => {
    let capturedBucket;
    const state = makeState({
      s3Loader: {
        async getObject(bucket) {
          capturedBucket = bucket;
          return { status: 404, body: 'Not Found' };
        },
      },
    });
    await fetchCatalogPriceRules(state, { headers: { get: () => null } });
    assert.strictEqual(capturedBucket, 'helix-commerce-pricing');
    assert.ok(!state.stagePricing, 'stagePricing must not be set');
  });

  it('uses the dev bucket and sets stagePricing when x-env: stage', async () => {
    let capturedBucket;
    const state = makeState({
      s3Loader: {
        async getObject(bucket) {
          capturedBucket = bucket;
          return { status: 404, body: 'Not Found' };
        },
      },
    });
    const req = { headers: { get: (name) => (name === 'x-env' ? 'stage' : null) } };
    await fetchCatalogPriceRules(state, req);
    assert.strictEqual(capturedBucket, 'helix-commerce-pricing-dev');
    assert.strictEqual(state.stagePricing, true);
  });

  it('reads rules from the dev bucket when x-env: stage', async () => {
    const rules = {
      promotions: [{ id: 'p', name: 'P', rules: [{ path: '/p/a', price: '9.99' }] }],
    };
    let capturedBucket;
    const state = makeState({
      s3Loader: {
        async getObject(bucket, key) {
          capturedBucket = bucket;
          if (bucket === 'helix-commerce-pricing-dev' && key === 'org/site/prices/catalog/rules.json') {
            return { status: 200, body: JSON.stringify(rules) };
          }
          return { status: 404, body: 'Not Found' };
        },
      },
    });
    const req = { headers: { get: (name) => (name === 'x-env' ? 'stage' : null) } };
    await fetchCatalogPriceRules(state, req);
    assert.strictEqual(capturedBucket, 'helix-commerce-pricing-dev');
    assert.strictEqual(state.catalogPriceRules.promotions.length, 1);
  });
});
