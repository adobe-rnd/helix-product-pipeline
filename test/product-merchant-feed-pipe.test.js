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
import esmock from 'esmock';
import { PipelineRequest, PipelineState } from '@adobe/helix-html-pipeline';
import { readFile } from 'fs/promises';
import { FileS3Loader } from './FileS3Loader.js';
import { productMerchantFeedPipe } from '../src/index.js';
import { toFeedXML } from '../src/product-merchant-feed-pipe.js';
import { getPathInfo } from '../src/utils/path.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
};

const DEFAULT_STATE = (opts = {}) => (new PipelineState({
  config: DEFAULT_CONFIG,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'live',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('Product Merchant Feed Pipe Test', () => {
  it('renders a merchant feed xml', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      index: 200,
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/merchant-center-feed.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/merchant-center-feed.xml');
    const resp = await productMerchantFeedPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/merchant-center-feed.xml')),
    );
    assert.strictEqual(resp.status, 200);

    const { body } = resp;
    const merchantXMLExpected = await readFile(new URL('./fixtures/index/merchant-feed.xml', import.meta.url), 'utf-8');

    assert.deepStrictEqual(body, merchantXMLExpected);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      // 'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/xml',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('renders a merchant feed xml (with sku based path)', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      index: 200,
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/merchant-center-feed.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
      config: {
        ...DEFAULT_CONFIG,
      },
    });
    state.info = getPathInfo('/products/merchant-center-feed.xml');
    const resp = await productMerchantFeedPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/merchant-center-feed.xml')),
    );
    assert.strictEqual(resp.status, 200);

    const { body } = resp;
    const merchantXMLExpected = await readFile(new URL('./fixtures/index/merchant-feed.xml', import.meta.url), 'utf-8');
    assert.deepStrictEqual(body, merchantXMLExpected);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      // 'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/xml',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('sends 400 for non xml path', async () => {
    const state = DEFAULT_STATE({
      path: '/blog/index',
    });
    const result = await productMerchantFeedPipe(state, new PipelineRequest('https://acme.com/products/'));
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'only xml resources supported.');
  });

  it('handles a 404', async () => {
    const s3Loader = new FileS3Loader();
    s3Loader.rewrite('merchant-feed.json', 'missing-file-404.json');

    const state = DEFAULT_STATE({
      s3Loader,
      path: '/products/merchant-center-feed.xml',
    });
    state.info = getPathInfo('/products/merchant-center-feed.xml');

    const result = await productMerchantFeedPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products2/merchant-center-feed.xml')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'failed to load org/site/indices/products/merchant-feed.json from product-bus: 404');
  });

  it('returns 404 for invalid path info', async () => {
    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/merchant-center-feed.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = false;

    const result = await productMerchantFeedPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/merchant-center-feed.xml')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'invalid path');
  });

  it('sets state type to merchant-feed', async () => {
    const s3Loader = new FileS3Loader();

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/merchant-center-feed.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');
    await productMerchantFeedPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/merchant-center-feed.xml')),
    );
    assert.strictEqual(state.type, 'merchant-feed');
  });

  it('returns early when res.error is set but res.status is less than 400', async () => {
    // Mock fetchContent to set res.error and res.status < 400
    const { productMerchantFeedPipe: pipe } = await esmock('../src/product-merchant-feed-pipe.js', {
      '../src/steps/fetch-productbus.js': {
        default: async (state, req, res) => {
          res.error = 'Some non-critical error';
          res.status = 200; // Status less than 400
        },
      },
    });

    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/merchant-center-feed.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/merchant-center-feed.xml');

    const result = await pipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/merchant-center-feed.xml')),
    );

    // Should return early without throwing PipelineStatusError
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.error, 'Some non-critical error');
    // Should not have gone through the full pipeline (no JSON body, no cache headers)
    assert.strictEqual(result.body, '');
  });

  it('handles root-level merchant feed path', async () => {
    const s3Loader = new FileS3Loader();

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/merchant-center-feed.xml',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/merchant-center-feed.xml');
    const resp = await productMerchantFeedPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/merchant-center-feed.xml')),
    );
    assert.strictEqual(resp.status, 200);

    const { body } = resp;
    const merchantFeedXMLExpected = await readFile(new URL('./fixtures/index/merchant-feed.xml', import.meta.url), 'utf-8');

    assert.deepStrictEqual(body, merchantFeedXMLExpected);
  });

  describe('toFeedXML', () => {
    it('returns a merchant feed xml', () => {
      const xml = toFeedXML(
        {
          prodHost: 'https://www.harborfreight.com',
          config: {
            merchantFeedConfig: {
              title: 'Test Title',
              description: 'Test Description',
              link: 'https://test.com',
            },
          },
        },
        new PipelineRequest('https://www.harborfreight.com/products/merchant-center-feed.xml'),
        {
          // product without title and price
          1111: {
            data: {
              id: '1111',
              description: 'This is a description',
              link: 'https://www.harborfreight.com/1111.html',
              image_link: './media_1111.jpg',
              condition: 'new',
              availability: 'in_stock',
              brand: 'Foo',
            },
          },
          1436: {
            data: {
              id: '1436',
              title: '28 ft. 10 in. x 39 ft. 4 in. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp',
              description: 'This 28 ft. 10 in. x 39 ft. 4 in. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp provides exceptional protection for equipment, tools, and other materials. Made with 14 x 14 mesh of 1000 denier nylon threads, the tarp is designed to withstand rain, snow, and especially sun with its silver reflective color that also keeps the items underneath cooler compared to conventional tarps. For tying down, the tarp has rust-resistant aluminum grommets.',
              link: 'https://www.harborfreight.com/28-ft-10-inch-x-39-ft-4-inch-reflective-heavy-duty-silver-tarpaulin-1436.html',
              image_link: './media_b526c80c86439f4afb9308d8963f073b872edef7.jpg',
              condition: 'new',
              availability: 'in_stock',
              price: '119.99 USD',
              brand: 'HFT',
              adult: 'no',
              variants: {
                1437: {
                  id: '1437',
                  title: '29 ft. 4 in. x 49 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp',
                  description: 'This 29 ft. 4 in. x 49 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp provides exceptional protection for equipment, tools, and other materials. Made with 14 x 14 mesh of 1000 denier nylon threads, the tarp is designed to withstand rain, snow, and especially sun with its silver reflective color that also keeps the items underneath cooler compared to conventional tarps. For tying down, the tarp has rust-resistant aluminum grommets.',
                  link: 'https://www.harborfreight.com/29-ft-4-inch-x-49-ft-reflective-heavy-duty-silver-tarpaulin-1437.html',
                  image_link: './media_b526c80c86439f4afb9308d8963f073b872edef7.jpg',
                  condition: 'new',
                  availability: 'in_stock',
                  price: '139.99 USD',
                  brand: 'HFT',
                  adult: 'no',
                  item_group_id: '1436',
                  shipping: {
                    country: 'US',
                    region: 'CA',
                    service: 'Fedex',
                    price: '8.99 USD',
                    min_handling_time: '1',
                    max_handling_time: '3',
                    min_transit_time: '1',
                    max_transit_time: '5',
                  },
                },

                1438: {
                  id: '1438',
                  title: '28 ft. 10 in. x 59 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp',
                  description: 'This 28 ft. 10 in. x 59 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp provides exceptional protection for equipment, tools, and other materials. Made with 14 x 14 mesh of 1000 denier nylon threads, the tarp is designed to withstand rain, snow, and especially sun with its silver reflective color that also keeps the items underneath cooler compared to conventional tarps. For tying down, the tarp has rust-resistant aluminum grommets.',
                  link: 'https://www.harborfreight.com/29-ft-4-inch-x-59-inch-reflective-heavy-duty-silver-tarpaulin-1438.html',
                  image_link: '/media_b526c80c86439f4afb9308d8963f073b872edef7.jpg',
                  condition: 'new',
                  availability: 'in_stock',
                  price: '159.99 USD',
                  brand: 'HFT',
                  adult: 'no',
                  item_group_id: '1436',
                },
              },
            },
          },
          1072: {
            data: {
              id: '1072',
              title: '7 in. Bench Brush',
              description: 'The "beaver tail" bench brush has a natural lacquered hardwood handle with a hang-up hole for storage. The extra-long synthetic bristles effectively trap dust and clear larger debris such as wood chips or metal shavings.',
              link: 'https://www.harborfreight.com/7-inch-bench-brush-1072.html',
              image_link: './media_71d3a9f748fab108ffc9405e65cd872efb143005.jpg',
              condition: 'new',
              availability: 'in_stock',
              price: '2.49 USD',
              adult: 'no',
              shipping: [
                {
                  country: 'US',
                  service: 'Standard',
                  price: '2.49 USD',
                },
              ],
            },
          },
          1106: {
            data: {
              id: '1106',
              title: '4 Oz. Flexible Spout Oil Can',
              description: 'This easy-to-use oil can has a seamless steel body for durability. The oil can incorporates a flexible braided PVC spout to reach hard-to-access areas. Built to handle frequent use in any busy shop.',
              link: 'https://www.harborfreight.com/4-oz-flexible-spout-oil-can-1106.html',
              image_link: './media_28c3ba6019250f2825570c2da1142b4985279290.jpg',
              condition: 'new',
              availability: 'in_stock',
              price: '5.99 USD',
              adult: 'no',
              shipping: 'US:CA:Overnight:16.00 USD:1:1:2:3',
            },
          },
          1132: {
            data: {
              id: '1132',
              title: '36 in. Steel Pipe Wrench',
              description: 'This steel pipe wrench stands up to heavy jobsite use. The heat-treated jaws grip tight and resist wear.',
              link: 'https://www.harborfreight.com/36-inch-steel-pipe-wrench-1132.html',
              image_link: './media_6aac6a6332c1608f9fa40bb43875dfb3ca80179c.jpg',
              condition: 'new',
              availability: 'in_stock',
              price: '22.99 USD',
              brand: 'PITTSBURGH',
              adult: 'no',
            },
          },
          1142: {
            data: {
              id: '1142',
              title: '8 in. White Cable Ties, 100-Pack',
              description: 'Organize wires, cables, and ropes and eliminate tangles or tripping hazards with these cable ties. The cable ties are made of tough nylon and certified to current fire standards.',
              link: 'https://www.harborfreight.com/pack-of-100-7-7-8-eighth-inch-x-3-16-inch-ties-1142.html',
              image_link: './media_1e2b7d649bcdd7bb69756a080111b74df57f0ef9.jpg',
              condition: 'new',
              availability: 'in_stock',
              price: '2.49 USD',
              brand: 'STOREHOUSE',
              adult: 'no',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Test Title</title>
  <link>https://test.com</link>
  <description>
  Test Description
  </description>
  <item>
    <g:id>1072</g:id>
    <g:title>7 in. Bench Brush</g:title>
    <g:description>
    The "beaver tail" bench brush has a natural lacquered hardwood handle with a hang-up hole for storage. The extra-long synthetic bristles effectively trap dust and clear larger debris such as wood chips or metal shavings.
    </g:description>
    <g:link>https://www.harborfreight.com/7-inch-bench-brush-1072.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_71d3a9f748fab108ffc9405e65cd872efb143005.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>2.49 USD</g:price>
    <g:brand></g:brand>
    <g:shipping>      
    <g:country>US</g:country>            
    <g:service>Standard</g:service>      
    <g:price>2.49 USD</g:price>                        
    </g:shipping>
  </item>  
  <item>
    <g:id>1106</g:id>
    <g:title>4 Oz. Flexible Spout Oil Can</g:title>
    <g:description>
    This easy-to-use oil can has a seamless steel body for durability. The oil can incorporates a flexible braided PVC spout to reach hard-to-access areas. Built to handle frequent use in any busy shop.
    </g:description>
    <g:link>https://www.harborfreight.com/4-oz-flexible-spout-oil-can-1106.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_28c3ba6019250f2825570c2da1142b4985279290.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>5.99 USD</g:price>
    <g:brand></g:brand>US:CA:Overnight:16.00 USD:1:1:2:3
  </item>  
  <item>
    <g:id>1111</g:id>
    <g:title></g:title>
    <g:description>
    This is a description
    </g:description>
    <g:link>https://www.harborfreight.com/1111.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_1111.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price></g:price>
    <g:brand>Foo</g:brand>
  </item>  
  <item>
    <g:id>1132</g:id>
    <g:title>36 in. Steel Pipe Wrench</g:title>
    <g:description>
    This steel pipe wrench stands up to heavy jobsite use. The heat-treated jaws grip tight and resist wear.
    </g:description>
    <g:link>https://www.harborfreight.com/36-inch-steel-pipe-wrench-1132.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_6aac6a6332c1608f9fa40bb43875dfb3ca80179c.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>22.99 USD</g:price>
    <g:brand>PITTSBURGH</g:brand>
  </item>  
  <item>
    <g:id>1142</g:id>
    <g:title>8 in. White Cable Ties, 100-Pack</g:title>
    <g:description>
    Organize wires, cables, and ropes and eliminate tangles or tripping hazards with these cable ties. The cable ties are made of tough nylon and certified to current fire standards.
    </g:description>
    <g:link>https://www.harborfreight.com/pack-of-100-7-7-8-eighth-inch-x-3-16-inch-ties-1142.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_1e2b7d649bcdd7bb69756a080111b74df57f0ef9.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>2.49 USD</g:price>
    <g:brand>STOREHOUSE</g:brand>
  </item>  
  <item>
    <g:id>1436</g:id>
    <g:title>28 ft. 10 in. x 39 ft. 4 in. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp</g:title>
    <g:description>
    This 28 ft. 10 in. x 39 ft. 4 in. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp provides exceptional protection for equipment, tools, and other materials. Made with 14 x 14 mesh of 1000 denier nylon threads, the tarp is designed to withstand rain, snow, and especially sun with its silver reflective color that also keeps the items underneath cooler compared to conventional tarps. For tying down, the tarp has rust-resistant aluminum grommets.
    </g:description>
    <g:link>https://www.harborfreight.com/28-ft-10-inch-x-39-ft-4-inch-reflective-heavy-duty-silver-tarpaulin-1436.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_b526c80c86439f4afb9308d8963f073b872edef7.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>119.99 USD</g:price>
    <g:brand>HFT</g:brand>
  </item>  
  <item>
    <g:id>1437</g:id>
    <g:title>29 ft. 4 in. x 49 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp</g:title>
    <g:description>
    This 29 ft. 4 in. x 49 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp provides exceptional protection for equipment, tools, and other materials. Made with 14 x 14 mesh of 1000 denier nylon threads, the tarp is designed to withstand rain, snow, and especially sun with its silver reflective color that also keeps the items underneath cooler compared to conventional tarps. For tying down, the tarp has rust-resistant aluminum grommets.
    </g:description>
    <g:link>https://www.harborfreight.com/29-ft-4-inch-x-49-ft-reflective-heavy-duty-silver-tarpaulin-1437.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_b526c80c86439f4afb9308d8963f073b872edef7.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>139.99 USD</g:price>
    <g:brand>HFT</g:brand>
    <g:item_group_id>1436</g:item_group_id>
    <g:shipping>      
    <g:country>US</g:country>      
    <g:region>CA</g:region>      
    <g:service>Fedex</g:service>      
    <g:price>8.99 USD</g:price>      
    <g:min_handling_time>1</g:min_handling_time>      
    <g:max_handling_time>3</g:max_handling_time>      
    <g:min_transit_time>1</g:min_transit_time>      
    <g:max_transit_time>5</g:max_transit_time>
    </g:shipping>
  </item>  
  <item>
    <g:id>1438</g:id>
    <g:title>28 ft. 10 in. x 59 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp</g:title>
    <g:description>
    This 28 ft. 10 in. x 59 ft. Heavy Duty Reflective All-Purpose Weather-Resistant Tarp provides exceptional protection for equipment, tools, and other materials. Made with 14 x 14 mesh of 1000 denier nylon threads, the tarp is designed to withstand rain, snow, and especially sun with its silver reflective color that also keeps the items underneath cooler compared to conventional tarps. For tying down, the tarp has rust-resistant aluminum grommets.
    </g:description>
    <g:link>https://www.harborfreight.com/29-ft-4-inch-x-59-inch-reflective-heavy-duty-silver-tarpaulin-1438.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_b526c80c86439f4afb9308d8963f073b872edef7.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>159.99 USD</g:price>
    <g:brand>HFT</g:brand>
    <g:item_group_id>1436</g:item_group_id>
  </item>  
</channel>
</rss>`);
    });

    it('handles prod hosts without protocol', () => {
      const xml = toFeedXML(
        {
          prodHost: 'www.harborfreight.com',
          config: {
            merchantFeedConfig: {
              title: 'Test Title',
              description: 'Test Description',
              link: 'https://test.com',
            },
          },
        },
        new PipelineRequest('https://www.harborfreight.com/products/merchant-center-feed.xml'),
        {
          1072: {
            data: {
              id: '1072',
              title: '7 in. Bench Brush',
              description: 'The "beaver tail" bench brush has a natural lacquered hardwood handle with a hang-up hole for storage. The extra-long synthetic bristles effectively trap dust and clear larger debris such as wood chips or metal shavings.',
              link: 'https://www.harborfreight.com/7-inch-bench-brush-1072.html',
              image_link: './media_71d3a9f748fab108ffc9405e65cd872efb143005.jpg',
              condition: 'new',
              availability: 'in_stock',
              price: '2.49 USD',
              adult: 'no',
              shipping: [
                {
                  country: 'US',
                  service: 'Standard',
                  price: '2.49 USD',
                },
              ],
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Test Title</title>
  <link>https://test.com</link>
  <description>
  Test Description
  </description>
  <item>
    <g:id>1072</g:id>
    <g:title>7 in. Bench Brush</g:title>
    <g:description>
    The "beaver tail" bench brush has a natural lacquered hardwood handle with a hang-up hole for storage. The extra-long synthetic bristles effectively trap dust and clear larger debris such as wood chips or metal shavings.
    </g:description>
    <g:link>https://www.harborfreight.com/7-inch-bench-brush-1072.html</g:link>
    <g:image_link>https://www.harborfreight.com/products/media_71d3a9f748fab108ffc9405e65cd872efb143005.jpg</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>in_stock</g:availability>
    <g:price>2.49 USD</g:price>
    <g:brand></g:brand>
    <g:shipping>      
    <g:country>US</g:country>            
    <g:service>Standard</g:service>      
    <g:price>2.49 USD</g:price>                        
    </g:shipping>
  </item>  
</channel>
</rss>`);
    });

    it('handles includes - noindex, includes all, should include', () => {
      const xml = toFeedXML(
        {
          prodHost: 'https://www.test.com',
          config: {
            merchantFeedConfig: {
              title: 'Test Title',
              description: 'Test Description',
              link: 'https://test.com',
            },
          },
        },
        new PipelineRequest('https://www.example.com/products/merchant-center-feed.xml?include=all'),
        {
          foo: {
            filters: {
              noindex: true,
            },
            data: {
              id: 'foo',
              title: 'Foo',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Test Title</title>
  <link>https://test.com</link>
  <description>
  Test Description
  </description>
  <item>
    <g:id>foo</g:id>
    <g:title>Foo</g:title>
    <g:description>
    
    </g:description>
    <g:link></g:link>
    <g:image_link></g:image_link>
    <g:condition></g:condition>
    <g:availability></g:availability>
    <g:price></g:price>
    <g:brand></g:brand>
  </item>  
</channel>
</rss>`);
    });

    it('handles includes - noindex, includes noindex, should include', () => {
      const xml = toFeedXML(
        {
          prodHost: 'https://www.test.com',
          config: {
            merchantFeedConfig: {
              title: 'Test Title',
              description: 'Test Description',
              link: 'https://test.com',
            },
          },
        },
        new PipelineRequest('https://www.example.com/products/merchant-center-feed.xml?include=noindex'),
        {
          foo: {
            filters: {
              noindex: true,
            },
            data: {
              id: 'foo',
              title: 'Foo',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Test Title</title>
  <link>https://test.com</link>
  <description>
  Test Description
  </description>
  <item>
    <g:id>foo</g:id>
    <g:title>Foo</g:title>
    <g:description>
    
    </g:description>
    <g:link></g:link>
    <g:image_link></g:image_link>
    <g:condition></g:condition>
    <g:availability></g:availability>
    <g:price></g:price>
    <g:brand></g:brand>
  </item>  
</channel>
</rss>`);
    });

    it('handles includes - noindex, includes foo, should not include', () => {
      const xml = toFeedXML(
        {
          prodHost: 'https://www.test.com',
          config: {
            merchantFeedConfig: {
              title: 'Test Title',
              description: 'Test Description',
              link: 'https://test.com',
            },
          },
        },
        new PipelineRequest('https://www.example.com/products/merchant-center-feed.xml?include=foo'),
        {
          foo: {
            filters: {
              noindex: true,
            },
            data: {
              id: 'foo',
              title: 'Foo',
            },
          },
        },
      );
      assert.deepStrictEqual(xml, `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Test Title</title>
  <link>https://test.com</link>
  <description>
  Test Description
  </description>
</channel>
</rss>`);
    });
  });
});
