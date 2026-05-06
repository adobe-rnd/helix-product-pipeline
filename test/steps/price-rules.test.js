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
import { fetchProductPriceRule, fetchCatalogPriceRules } from '../../src/steps/fetch-price-rules.js';

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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyProductPriceRule
// ---------------------------------------------------------------------------

describe('applyProductPriceRule', () => {
  it('no-ops when priceRule is absent', () => {
    const state = { content: { data: { price: { final: '10.00' } } } };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '10.00');
  });

  it('no-ops when content.data is absent', () => {
    const state = { priceRule: { price: '5.00' }, content: {} };
    applyProductPriceRule(state);
  });

  it('sets price.final from rule when always active (no dates)', () => {
    const state = {
      priceRule: { price: '29.99' },
      content: { data: { price: { final: '50.00' } } },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '29.99');
  });

  it('applies rule when start is in the past', () => {
    const state = {
      priceRule: { price: '25.00', start: PAST },
      content: { data: { price: { final: '50.00' } } },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '25.00');
  });

  it('does not apply rule when start is in the future', () => {
    const state = {
      priceRule: { price: '25.00', start: FUTURE },
      content: { data: { price: { final: '50.00' } } },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('applies rule when end is in the future', () => {
    const state = {
      priceRule: { price: '25.00', end: FUTURE },
      content: { data: { price: { final: '50.00' } } },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '25.00');
  });

  it('does not apply rule when end is in the past', () => {
    const state = {
      priceRule: { price: '25.00', end: PAST },
      content: { data: { price: { final: '50.00' } } },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '50.00');
  });

  it('inherits parent price to array variants without a variant rule', () => {
    const state = {
      priceRule: { price: '20.00' },
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '20.00');
  });

  it('applies variant-specific rule from array variants', () => {
    const state = {
      priceRule: {
        price: '20.00',
        variants: { 'sku-a': { price: '15.00' } },
      },
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '15.00');
  });

  it('applies variant-specific rule from object-keyed variants', () => {
    const state = {
      priceRule: {
        price: '20.00',
        variants: { 'sku-b': { price: '12.00' } },
      },
      content: {
        data: {
          price: { final: '50.00' },
          variants: { 'sku-b': { sku: 'sku-b', price: { final: '50.00' } } },
        },
      },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants['sku-b'].price.final, '12.00');
  });

  it('skips expired variant rule and inherits parent price instead', () => {
    const state = {
      priceRule: {
        price: '20.00',
        variants: { 'sku-a': { price: '5.00', end: PAST } },
      },
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a', price: { final: '50.00' } }],
        },
      },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.variants[0].price.final, '20.00');
  });

  it('handles product with no variants field', () => {
    const state = {
      priceRule: { price: '30.00' },
      content: { data: { price: { final: '50.00' } } },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '30.00');
  });

  it('skips variant price update when variant has no price field', () => {
    const state = {
      priceRule: { price: '20.00' },
      content: {
        data: {
          price: { final: '50.00' },
          variants: [{ sku: 'sku-a' }],
        },
      },
    };
    applyProductPriceRule(state);
    assert.strictEqual(state.content.data.price.final, '20.00');
    assert.strictEqual(state.content.data.variants[0].price, undefined);
  });
});

// ---------------------------------------------------------------------------
// applyCatalogPriceRules
// ---------------------------------------------------------------------------

describe('applyCatalogPriceRules', () => {
  it('no-ops when catalogPriceRules is absent', () => {
    const state = { content: { data: { '/p/a': { data: { path: '/p/a', price: { final: '10.00' } } } } } };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['/p/a'].data.price.final, '10.00');
  });

  it('no-ops when content.data is absent', () => {
    const state = { catalogPriceRules: { '/p/a': { price: '5.00' } }, content: {} };
    applyCatalogPriceRules(state);
  });

  it('applies matching catalog rule to index entry', () => {
    const state = {
      catalogPriceRules: { '/p/a': { price: '25.00' } },
      content: {
        data: {
          'key-a': { data: { path: '/p/a', price: { final: '50.00' } } },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price.final, '25.00');
  });

  it('skips index entry with no matching rule', () => {
    const state = {
      catalogPriceRules: { '/p/other': { price: '25.00' } },
      content: {
        data: {
          'key-a': { data: { path: '/p/a', price: { final: '50.00' } } },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-a'].data.price.final, '50.00');
  });

  it('skips entries with no data or no path', () => {
    const state = {
      catalogPriceRules: { '/p/a': { price: '25.00' } },
      content: {
        data: {
          'key-null': null,
          'key-no-data': {},
          'key-no-path': { data: { price: { final: '10.00' } } },
        },
      },
    };
    applyCatalogPriceRules(state);
    assert.strictEqual(state.content.data['key-no-path'].data.price.final, '10.00');
  });
});

// ---------------------------------------------------------------------------
// fetchProductPriceRule
// ---------------------------------------------------------------------------

describe('fetchProductPriceRule', () => {
  it('sets priceRule from R2 when object is found', async () => {
    const rule = { price: '19.99' };
    const state = makeState({
      s3Loader: makeS3Loader({
        'org/site/prices/catalog/_byPath/us/en/my-product.json': rule,
      }),
    });
    await fetchProductPriceRule(state);
    assert.deepStrictEqual(state.priceRule, rule);
  });

  it('sets priceRule to null when object is not found (404)', async () => {
    const state = makeState();
    await fetchProductPriceRule(state);
    assert.strictEqual(state.priceRule, null);
  });

  it('strips .html extension from path when building key', async () => {
    const rule = { price: '9.99' };
    const state = makeState({
      info: { path: '/us/en/my-product.html' },
      s3Loader: makeS3Loader({
        'org/site/prices/catalog/_byPath/us/en/my-product.json': rule,
      }),
    });
    await fetchProductPriceRule(state);
    assert.deepStrictEqual(state.priceRule, rule);
  });

  it('handles path that does not start with slash', async () => {
    const rule = { price: '7.99' };
    const state = makeState({
      info: { path: 'us/en/no-leading-slash' },
      s3Loader: makeS3Loader({
        'org/site/prices/catalog/_byPath/us/en/no-leading-slash.json': rule,
      }),
    });
    await fetchProductPriceRule(state);
    assert.deepStrictEqual(state.priceRule, rule);
  });

  it('sets priceRule to null on s3Loader error', async () => {
    const state = makeState({
      s3Loader: {
        getObject: async () => { throw new Error('R2 down'); },
      },
    });
    await fetchProductPriceRule(state);
    assert.strictEqual(state.priceRule, null);
  });
});

// ---------------------------------------------------------------------------
// fetchCatalogPriceRules
// ---------------------------------------------------------------------------

describe('fetchCatalogPriceRules', () => {
  it('sets catalogPriceRules from R2', async () => {
    const rules = {
      '/p/a': { price: '29.99', start: PAST, end: FUTURE },
      '/p/b': { price: '49.99' },
    };
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': rules }),
    });
    await fetchCatalogPriceRules(state);
    assert.ok('/p/a' in state.catalogPriceRules);
    assert.ok('/p/b' in state.catalogPriceRules);
  });

  it('pre-filters rules whose end is in the past', async () => {
    const rules = {
      '/p/active': { price: '10.00', end: FUTURE },
      '/p/expired': { price: '5.00', end: PAST },
    };
    const state = makeState({
      s3Loader: makeS3Loader({ 'org/site/prices/catalog/rules.json': rules }),
    });
    await fetchCatalogPriceRules(state);
    assert.ok('/p/active' in state.catalogPriceRules);
    assert.ok(!('/p/expired' in state.catalogPriceRules));
  });

  it('sets catalogPriceRules to {} when object is not found (404)', async () => {
    const state = makeState();
    await fetchCatalogPriceRules(state);
    assert.deepStrictEqual(state.catalogPriceRules, {});
  });

  it('sets catalogPriceRules to {} on s3Loader error', async () => {
    const state = makeState({
      s3Loader: {
        getObject: async () => { throw new Error('R2 down'); },
      },
    });
    await fetchCatalogPriceRules(state);
    assert.deepStrictEqual(state.catalogPriceRules, {});
  });
});
