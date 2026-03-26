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
import { convertToJsonLD } from '../../src/steps/render-jsonld.js';

// Minimal state mock for testing
const mockState = {
  config: {},
};

describe('convertToJsonLD', () => {
  describe('jsonld override', () => {
    it('uses jsonld object from product when provided', () => {
      const customJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Custom Product Name',
        sku: 'CUSTOM-SKU',
        description: 'Custom description from override',
        offers: {
          '@type': 'Offer',
          price: '199.99',
          priceCurrency: 'USD',
        },
      };

      const product = {
        sku: 'ORIGINAL-SKU',
        name: 'Original Product Name',
        jsonld: customJsonLd,
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.name, 'Custom Product Name');
      assert.strictEqual(parsed.sku, 'CUSTOM-SKU');
      assert.strictEqual(parsed.description, 'Custom description from override');
      assert.strictEqual(parsed.offers.price, '199.99');
    });

    it('uses jsonld string from product when provided', () => {
      const customJsonLdString = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'String Override Product',
        sku: 'STRING-SKU',
      });

      const product = {
        sku: 'ORIGINAL-SKU',
        name: 'Original Product Name',
        jsonld: customJsonLdString,
      };

      const result = convertToJsonLD(mockState, product);

      assert.strictEqual(result, customJsonLdString);
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.name, 'String Override Product');
      assert.strictEqual(parsed.sku, 'STRING-SKU');
    });

    it('generates jsonld when jsonld property is not provided', () => {
      const product = {
        sku: 'GENERATED-SKU',
        name: 'Generated Product Name',
        metaDescription: 'A generated description',
        brand: 'TestBrand',
        url: 'https://example.com/product',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed['@context'], 'https://schema.org');
      assert.strictEqual(parsed['@type'], 'Product');
      assert.strictEqual(parsed.sku, 'GENERATED-SKU');
      assert.strictEqual(parsed.name, 'Generated Product Name');
      assert.strictEqual(parsed.description, 'A generated description');
      assert.strictEqual(parsed.brand.name, 'TestBrand');
    });

    it('generates jsonld when jsonld property is null', () => {
      const product = {
        sku: 'NULL-SKU',
        name: 'Null JsonLd Product',
        jsonld: null,
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed['@context'], 'https://schema.org');
      assert.strictEqual(parsed.sku, 'NULL-SKU');
      assert.strictEqual(parsed.name, 'Null JsonLd Product');
    });

    it('generates jsonld when jsonld property is undefined', () => {
      const product = {
        sku: 'UNDEFINED-SKU',
        name: 'Undefined JsonLd Product',
        jsonld: undefined,
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed['@context'], 'https://schema.org');
      assert.strictEqual(parsed.sku, 'UNDEFINED-SKU');
    });

    it('preserves complex nested structures in jsonld override', () => {
      const customJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Complex Product',
        offers: [
          {
            '@type': 'Offer',
            price: '99.99',
            priceCurrency: 'USD',
            seller: {
              '@type': 'Organization',
              name: 'Custom Seller',
            },
          },
          {
            '@type': 'Offer',
            price: '89.99',
            priceCurrency: 'EUR',
          },
        ],
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.5',
          reviewCount: '100',
        },
        review: [
          {
            '@type': 'Review',
            author: 'John Doe',
            reviewRating: {
              '@type': 'Rating',
              ratingValue: '5',
            },
          },
        ],
      };

      const product = {
        sku: 'SKU-123',
        jsonld: customJsonLd,
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.offers.length, 2);
      assert.strictEqual(parsed.offers[0].seller.name, 'Custom Seller');
      assert.strictEqual(parsed.aggregateRating.ratingValue, '4.5');
      assert.strictEqual(parsed.review[0].reviewRating.ratingValue, '5');
    });

    it('handles empty jsonld object by returning it as-is', () => {
      const product = {
        sku: 'EMPTY-OVERRIDE-SKU',
        name: 'Empty Override Product',
        jsonld: {},
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      // Empty object should be returned as-is
      assert.deepStrictEqual(parsed, {});
    });
  });

  describe('jsonldExtensions', () => {
    it('merges jsonldExtensions into generated jsonld', () => {
      const product = {
        sku: 'EXT-SKU',
        name: 'Extension Product',
        images: [],
        variants: [],
        jsonldExtensions: {
          potentialAction: [
            {
              '@type': 'QuoteAction',
              name: 'Request a Quote',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://example.com/quote',
              },
            },
          ],
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed['@type'], 'Product');
      assert.strictEqual(parsed.sku, 'EXT-SKU');
      assert.ok(Array.isArray(parsed.potentialAction));
      assert.strictEqual(parsed.potentialAction[0]['@type'], 'QuoteAction');
      assert.strictEqual(parsed.potentialAction[0].name, 'Request a Quote');
      assert.strictEqual(parsed.potentialAction[0].target.urlTemplate, 'https://example.com/quote');
    });

    it('handles multiple potentialActions including location-specific', () => {
      const product = {
        sku: 'EXT-SKU',
        name: 'Extension Product',
        images: [],
        variants: [],
        jsonldExtensions: {
          potentialAction: [
            {
              '@type': 'QuoteAction',
              name: 'Request a Quote',
              target: { '@type': 'EntryPoint', urlTemplate: 'https://example.com/quote' },
            },
            {
              '@type': 'QuoteAction',
              name: 'Request a Quote',
              target: { '@type': 'EntryPoint', urlTemplate: 'https://example.com/quote?ca=1' },
              location: { '@type': 'Country', name: 'CA' },
            },
          ],
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.potentialAction.length, 2);
      assert.deepStrictEqual(parsed.potentialAction[1].location, { '@type': 'Country', name: 'CA' });
    });

    it('does not add potentialAction when jsonldExtensions is absent', () => {
      const product = {
        sku: 'EXT-SKU',
        name: 'Extension Product',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.potentialAction, undefined);
    });

    it('supports any schema.org extension field, not just potentialAction', () => {
      const product = {
        sku: 'EXT-SKU',
        name: 'Extension Product',
        images: [],
        variants: [],
        jsonldExtensions: {
          award: 'Best Product 2025',
          review: [{ '@type': 'Review', author: 'Jane', reviewBody: 'Great product' }],
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.award, 'Best Product 2025');
      assert.strictEqual(parsed.review[0].author, 'Jane');
    });

    it('does not apply jsonldExtensions when jsonld override is used', () => {
      const product = {
        sku: 'EXT-SKU',
        name: 'Extension Product',
        jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: 'Override Name' },
        jsonldExtensions: {
          potentialAction: [{ '@type': 'QuoteAction' }],
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.name, 'Override Name');
      assert.strictEqual(parsed.potentialAction, undefined);
    });

    it('does not apply variant jsonldExtensions when jsonld override is used', () => {
      const product = {
        sku: 'EXT-SKU',
        name: 'Extension Product',
        jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: 'Override Name' },
        variants: [
          {
            sku: 'VAR-1',
            name: 'Variant 1',
            price: { currency: 'USD', final: '29.99' },
            availability: 'InStock',
            jsonldExtensions: {
              potentialAction: [{ '@type': 'QuoteAction', name: 'Quote Variant' }],
            },
          },
        ],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.name, 'Override Name');
      assert.strictEqual(parsed.potentialAction, undefined);
      assert.strictEqual(parsed.offers, undefined, 'jsonld override must not generate offers');
    });

    it('product jsonldExtensions can overwrite auto-generated Product keys', () => {
      const product = {
        sku: 'RES-SKU',
        name: 'Reserved Key Product',
        description: 'Original description',
        brand: 'OriginalBrand',
        url: 'https://example.com/original',
        gtin: '0000000000000',
        images: [],
        variants: [],
        jsonldExtensions: {
          '@context': 'https://custom-context.org',
          '@type': 'SomeOtherType',
          name: 'Overridden Name',
          description: 'Overridden description',
          brand: { '@type': 'Brand', name: 'OverriddenBrand' },
          sku: 'OVERRIDDEN-SKU',
          url: 'https://example.com/overridden',
          gtin: '9999999999999',
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed['@context'], 'https://custom-context.org');
      assert.strictEqual(parsed['@type'], 'SomeOtherType');
      assert.strictEqual(parsed.name, 'Overridden Name');
      assert.strictEqual(parsed.description, 'Overridden description');
      assert.strictEqual(parsed.brand.name, 'OverriddenBrand');
      assert.strictEqual(parsed.sku, 'OVERRIDDEN-SKU');
      assert.strictEqual(parsed.url, 'https://example.com/overridden');
      assert.strictEqual(parsed.gtin, '9999999999999');
    });

    it('variant jsonldExtensions can overwrite auto-generated Offer keys', () => {
      const product = {
        sku: 'PARENT-SKU',
        name: 'Product with Variants',
        images: [],
        variants: [
          {
            sku: 'VAR-1',
            name: 'Variant 1',
            price: { currency: 'USD', final: '29.99' },
            availability: 'InStock',
            gtin: '1111111111111',
            url: 'https://example.com/var-1',
            jsonldExtensions: {
              '@type': 'AggregateOffer',
              sku: 'OVERRIDDEN-VAR-SKU',
              name: 'Overridden Variant Name',
              price: '0.00',
              priceCurrency: 'EUR',
              availability: 'https://schema.org/PreOrder',
              gtin: '9999999999999',
              url: 'https://example.com/overridden-var',
            },
          },
        ],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      const offer = parsed.offers[0];
      assert.strictEqual(offer['@type'], 'AggregateOffer');
      assert.strictEqual(offer.sku, 'OVERRIDDEN-VAR-SKU');
      assert.strictEqual(offer.name, 'Overridden Variant Name');
      assert.strictEqual(offer.price, '0.00');
      assert.strictEqual(offer.priceCurrency, 'EUR');
      assert.strictEqual(offer.availability, 'https://schema.org/PreOrder');
      assert.strictEqual(offer.gtin, '9999999999999');
      assert.strictEqual(offer.url, 'https://example.com/overridden-var');
    });

    it('spreads variant jsonldExtensions into that variant offer', () => {
      const product = {
        sku: 'VAR-PARENT-SKU',
        name: 'Product with Variants',
        images: [],
        variants: [
          {
            sku: 'VAR-1',
            name: 'Variant 1',
            price: { currency: 'USD', final: '29.99' },
            availability: 'InStock',
            jsonldExtensions: {
              potentialAction: [{ '@type': 'QuoteAction', name: 'Quote Variant 1' }],
            },
          },
          {
            sku: 'VAR-2',
            name: 'Variant 2',
            price: { currency: 'USD', final: '39.99' },
            availability: 'InStock',
          },
        ],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.offers.length, 2);
      assert.ok(Array.isArray(parsed.offers[0].potentialAction), 'VAR-1 offer must have potentialAction from jsonldExtensions');
      assert.strictEqual(parsed.offers[0].potentialAction[0]['@type'], 'QuoteAction');
      assert.strictEqual(parsed.offers[1].potentialAction, undefined, 'VAR-2 offer must not have potentialAction');
    });

    it('does not spread product jsonldExtensions into offer for simple product (no variants)', () => {
      const product = {
        sku: 'SIMPLE-SKU',
        name: 'Simple Product',
        price: { currency: 'USD', final: '49.99' },
        availability: 'InStock',
        images: [],
        variants: [],
        jsonldExtensions: {
          potentialAction: [{ '@type': 'QuoteAction', name: 'Quote Simple' }],
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      // Spread into Product object
      assert.ok(Array.isArray(parsed.potentialAction), 'Product must have potentialAction');
      assert.strictEqual(parsed.potentialAction[0]['@type'], 'QuoteAction');

      // NOT spread into the single offer
      assert.strictEqual(parsed.offers.length, 1);
      assert.strictEqual(parsed.offers[0].potentialAction, undefined, 'Simple product offer must not inherit product-level jsonldExtensions');
    });

    it('does not spread product jsonldExtensions into variant offers', () => {
      const product = {
        sku: 'PARENT-SKU',
        name: 'Product with Variants',
        images: [],
        variants: [
          {
            sku: 'VAR-1',
            name: 'Variant 1',
            price: { currency: 'USD', final: '29.99' },
            availability: 'InStock',
          },
        ],
        jsonldExtensions: {
          potentialAction: [{ '@type': 'QuoteAction', name: 'Product Level' }],
        },
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      // Product object gets the extensions
      assert.ok(Array.isArray(parsed.potentialAction), 'Product must have potentialAction');

      // But the variant offers do not inherit product-level extensions
      assert.strictEqual(parsed.offers[0].potentialAction, undefined, 'Variant offer must not inherit product-level jsonldExtensions');
    });
  });

  describe('standard generation', () => {
    it('generates basic product jsonld', () => {
      const product = {
        sku: 'BASIC-SKU',
        name: 'Basic Product',
        description: 'A basic product description',
        gtin: '1234567890123',
        url: 'https://example.com/basic-product',
        brand: 'BasicBrand',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed['@context'], 'https://schema.org');
      assert.strictEqual(parsed['@type'], 'Product');
      assert.strictEqual(parsed.sku, 'BASIC-SKU');
      assert.strictEqual(parsed.name, 'Basic Product');
      assert.strictEqual(parsed.description, 'A basic product description');
      assert.strictEqual(parsed.gtin, '1234567890123');
      assert.strictEqual(parsed.url, 'https://example.com/basic-product');
      assert.strictEqual(parsed.brand['@type'], 'Brand');
      assert.strictEqual(parsed.brand.name, 'BasicBrand');
    });

    it('uses metaTitle when name is not provided', () => {
      const product = {
        sku: 'META-SKU',
        metaTitle: 'Meta Title Product',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.name, 'Meta Title Product');
    });

    it('uses metaDescription over description when both provided', () => {
      const product = {
        sku: 'DESC-SKU',
        metaDescription: 'Meta description wins',
        description: 'Regular description',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.description, 'Meta description wins');
    });

    it('strips HTML from description when metaDescription is not provided', () => {
      const product = {
        sku: 'HTML-SKU',
        description: '<p>This is a <strong>bold</strong> description</p>',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.description, 'This is a bold description');
    });

    it('includes custom data in jsonld', () => {
      const product = {
        sku: 'CUSTOM-DATA-SKU',
        name: 'Custom Data Product',
        custom: {
          warranty: '2 Years',
          category: 'Electronics',
        },
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.deepStrictEqual(parsed.custom, {
        warranty: '2 Years',
        category: 'Electronics',
      });
    });

    it('generates offers from variants', () => {
      const product = {
        sku: 'VARIANTS-SKU',
        name: 'Product with Variants',
        images: [],
        variants: [
          {
            sku: 'VAR-1',
            name: 'Variant 1',
            price: { currency: 'USD', final: '29.99' },
            availability: 'InStock',
          },
          {
            sku: 'VAR-2',
            name: 'Variant 2',
            price: { currency: 'USD', final: '39.99' },
            availability: 'OutOfStock',
          },
        ],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.offers.length, 2);
      assert.strictEqual(parsed.offers[0].sku, 'VAR-1');
      assert.strictEqual(parsed.offers[0].price, '29.99');
      assert.strictEqual(parsed.offers[0].availability, 'https://schema.org/InStock');
      assert.strictEqual(parsed.offers[1].sku, 'VAR-2');
      assert.strictEqual(parsed.offers[1].availability, 'https://schema.org/OutOfStock');
    });

    it('generates single offer from product when no variants', () => {
      const product = {
        sku: 'SIMPLE-SKU',
        name: 'Simple Product',
        price: { currency: 'USD', final: '49.99' },
        availability: 'InStock',
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.offers.length, 1);
      assert.strictEqual(parsed.offers[0]['@type'], 'Offer');
      assert.strictEqual(parsed.offers[0].sku, 'SIMPLE-SKU');
      assert.strictEqual(parsed.offers[0].price, '49.99');
    });

    it('includes priceSpecification when regular price is higher than final', () => {
      const product = {
        sku: 'SALE-SKU',
        name: 'Sale Product',
        price: { currency: 'USD', final: '79.99', regular: '99.99' },
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.offers[0].price, '79.99');
      assert.strictEqual(parsed.offers[0].priceSpecification['@type'], 'UnitPriceSpecification');
      assert.strictEqual(parsed.offers[0].priceSpecification.priceType, 'https://schema.org/ListPrice');
      assert.strictEqual(parsed.offers[0].priceSpecification.price, 99.99);
      assert.strictEqual(parsed.offers[0].priceSpecification.priceCurrency, 'USD');
    });

    it('does not include priceSpecification when prices are equal', () => {
      const product = {
        sku: 'REGULAR-SKU',
        name: 'Regular Price Product',
        price: { currency: 'USD', final: '99.99', regular: '99.99' },
        images: [],
        variants: [],
      };

      const result = convertToJsonLD(mockState, product);
      const parsed = JSON.parse(result);

      assert.strictEqual(parsed.offers[0].priceSpecification, undefined);
    });
  });
});
