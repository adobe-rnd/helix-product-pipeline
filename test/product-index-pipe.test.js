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
import { FileS3Loader } from './FileS3Loader.js';
import { productIndexPipe, toSpreadsheet } from '../src/index.js';
import { getPathInfo } from '../src/utils/path.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
  public: {
    patterns: {
      base: {
        storeViewCode: 'default',
        storeCode: 'main',
      },
      '/products/{{urlKey}}': {
        pageType: 'product',
      },
    },
  },
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

describe('Product Index Pipe Test', () => {
  it('renders an index json in spreadsheet format', async () => {
    const s3Loader = new FileS3Loader();

    s3Loader.statusCodeOverrides = {
      index: 200,
    };

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');
    const resp = await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );
    assert.strictEqual(resp.status, 200);

    const body = JSON.parse(resp.body);
    assert.deepStrictEqual(body, {
      ':type': 'sheet',
      columns: [
        'sku',
        'urlKey',
        'title',
        'price',
        'image',
        'description',
        'series',
        'colors',
        'parentSku',
        'variantSkus',
      ],
      data: [
        {
          sku: 'vbndax5ks',
          urlKey: 'ascent-x5-smartprep-kitchen-system',
          title: 'Ascent® X5 SmartPrep™ Kitchen System',
          price: '949.95',
          image: './media_20b43ff4abb1e54666eb0fa736b1343ac894a794.jpg',
          description: '',
          series: 'Ascent X Series',
          colors: 'Brushed Stainless Metal Finish,Black',
          variantSkus: '073495-04-VB,074104-04-VB',
        },
        {
          parentSku: 'vbndax5ks',
          sku: '073495-04-VB',
          title: 'Ascent X5-Brushed Stainless Metal Finish',
          price: '949.95',
          image: './media_a7274c9d79252baba87664333cf9400a9e9e7035.jpg',
        },
        {
          parentSku: 'vbndax5ks',
          sku: '074104-04-VB',
          title: 'Ascent X5-Graphite Metal Finish',
          price: '949.95',
          image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
        },
        {
          sku: 'x2-kitchen-system',
          urlKey: 'ascent-x2-smartprep-kitchen-system',
          title: 'Ascent® X2 SmartPrep Kitchen System',
          price: '749.95',
          colors: 'Shadow Black',
          image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
          description: '',
          series: 'Ascent X Series',
          variantSkus: '075710-100',
        },
        {
          parentSku: 'x2-kitchen-system',
          sku: '075710-100',
          title: 'Ascent® X2 SmartPrep Kitchen System-Shadow Black',
          price: '749.95',
          image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
        },
        {
          sku: 'ascent-x5',
          urlKey: 'ascent-x5',
          title: 'Ascent® X5',
          price: '749.95',
          colors: 'Brushed Stainless Metal Finish,Graphite Metal Finish',
          image: './media_7bacc89abbcd1d51e8395fd123cdd3c5d5a3d057.png',
          description: '',
          series: 'Ascent X Series',
          variantSkus: '073495-04,074104-04',
        },
        {
          parentSku: 'ascent-x5',
          sku: '073495-04',
          title: 'Ascent X5-Brushed Stainless Metal Finish',
          price: '749.95',
          image: './media_caee0cae83d8cb8fba9d445b91c91574c4a05e34.jpg',
        },
        {
          parentSku: 'ascent-x5',
          sku: '074104-04',
          title: 'Ascent® X5-Graphite Metal Finish',
          price: '749.95',
          image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
        },
        {
          sku: 'ascent-x3',
          urlKey: 'ascent-x3',
          title: 'Ascent® X3',
          price: '649.95',
          colors: 'Shadow Black,Polar White',
          image: './media_2c49c87d765cc2cf6445df14f9051f5cfea7fb3c.png',
          description: '',
          series: 'Ascent X Series',
          variantSkus: '073493,074097',
        },
        {
          parentSku: 'ascent-x3',
          sku: '073493',
          title: 'Ascent X3-Shadow Black',
          price: '649.95',
          image: './media_15c2801b61b5e1736ff828154da0bfbfc637cd4e.jpg',
        },
        {
          parentSku: 'ascent-x3',
          sku: '074097',
          title: 'Ascent X3-Polar White',
          price: '649.95',
          image: './media_fdd5312b15e741890074232b7ca5567d9ddae532.jpg',
        },
        {
          sku: 'ascent-x2',
          urlKey: 'ascent-x2',
          title: 'Ascent® X2',
          price: '549.95',
          colors: 'Shadow Black,Polar White,Nano Gray,Midnight Blue',
          image: './media_f7d6a3efad20803d329c07665bc0b8c07e08671a.png',
          description: '',
          series: 'Ascent X Series',
          variantSkus: '073492-04,074094-04,074095-04,074096-04',
        },
        {
          parentSku: 'ascent-x2',
          sku: '073492-04',
          title: 'Ascent X2-Shadow Black',
          price: '549.95',
          image: './media_bc62e9d86264b33e2600b8aa889cc49e9f249289.jpg',
        },
        {
          parentSku: 'ascent-x2',
          sku: '074094-04',
          title: 'Ascent X2-Polar White',
          price: '549.95',
          image: './media_413e9a9e8bd489edc5f383138d82004769470b6f.jpg',
        },
        {
          parentSku: 'ascent-x2',
          sku: '074095-04',
          title: 'Ascent X2- Nano Gray',
          price: '549.95',
          image: './media_424a2d7c1a6acc023603016958343809df5da517.jpg',
        },
        {
          parentSku: 'ascent-x2',
          sku: '074096-04',
          title: 'Ascent X2-Midnight Blue',
          price: '549.95',
          image: './media_7c4ea652378a9560b28e767dab1ebee177e114f8.jpg',
        },
        {
          sku: 'vbnd5200lb',
          urlKey: '5200-legacy-bundle',
          title: '5200 Legacy Bundle',
          price: '649.95',
          colors: 'Black,White,Red',
          image: './media_7d951fc054b4643b15d0d15b69ee94c773a60916.jpg',
          description: '',
          variantSkus: '001372-1093-VB,001371-1092-VB,001392-1138-VB',
        },
        {
          parentSku: 'vbnd5200lb',
          sku: '001372-1093-VB',
          title: '5200 Standard - Getting Started',
          price: '649.95',
          image: './media_0185f10238249fd92247bd8dc1eca67e851612cc.jpg',
        },
        {
          parentSku: 'vbnd5200lb',
          sku: '001371-1092-VB',
          title: '5200 Standard - Getting Started White',
          price: '649.95',
          image: './media_64c4c80da4be5f6927530dd69d04a6e41e24039e.jpg',
        },
        {
          parentSku: 'vbnd5200lb',
          sku: '001392-1138-VB',
          title: '5200 Standard - Getting Started Red',
          price: '649.95',
          image: './media_afb408cb9a5dd7812327b21f3d1265818a2c2c53.jpg',
        },
        {
          sku: 'propel750',
          urlKey: 'propel-series-750',
          title: 'Propel 750',
          price: '629.95',
          colors: 'Black,Red,White,Slate',
          image: './media_a379c4ba76e36ca8dfd5d20e50f67a03cc4cd7b4.jpg',
          description: '',
          variantSkus: '071395,073294,073295,073296',
        },
        {
          parentSku: 'propel750',
          sku: '071395',
          title: 'Propel Series 750 Black',
          price: '629.95',
          image: './media_da2da61a3412c3f8ed311a10ce1d30147f7673e0.jpg',
        },
        {
          parentSku: 'propel750',
          sku: '073294',
          title: 'Propel Series 750 Red',
          price: '629.95',
          image: './media_4e9ffc439f66cc5e662721dd501d506e0b86dcfa.png',
        },
        {
          parentSku: 'propel750',
          sku: '073295',
          title: 'Propel Series 750 White',
          price: '629.95',
          image: './media_462badead7c64b4ac3d890e2353c3353fa76dbec.png',
        },
        {
          parentSku: 'propel750',
          sku: '073296',
          title: 'Propel Series 750 Slate',
          price: '629.95',
          image: './media_289ac0dd71906308849bf789920c2e7414b303cf.png',
        },
        {
          sku: 'propel510',
          urlKey: 'propel-series-510',
          title: 'Propel 510',
          price: '499.95',
          colors: 'Black,Red,White,Slate',
          image: './media_dd371dba39ab4d82cc275a300747506f9af083cc.jpg',
          description: '',
          variantSkus: '071394,073291,073292,073293',
        },
        {
          parentSku: 'propel510',
          sku: '071394',
          title: 'Propel Series 510 - Black',
          price: '499.95',
        },
        {
          parentSku: 'propel510',
          sku: '073291',
          title: 'Propel Series 510 - Red',
          price: '499.95',
          image: './media_6b91bd8f1ec90f0d75e085323b4837373ee7742c.png',
        },
        {
          parentSku: 'propel510',
          sku: '073292',
          title: 'Propel Series 510 - White',
          price: '499.95',
          image: './media_236c6c9a5b3edaf055dd84f447c9d4894b643f83.png',
        },
        {
          parentSku: 'propel510',
          sku: '073293',
          title: 'Propel Series 510 - Slate',
          price: '499.95',
          image: './media_760d2307ac66ab8cc9b96030d52bfd57c848e686.png',
        },
        {
          sku: 'vbndibcb',
          urlKey: '5-speed-immersion-blender-complete-bundle',
          title: '5-Speed Immersion Blender Complete Bundle',
          price: '269.95',
          image: './media_a06fc6262385bc24ef356a95f7516717969be6b5.jpg',
          description: '',
          series: 'Immersion',
        },
        {
          sku: 'vbnde310',
          urlKey: 'e310-and-pca-bundle',
          title: 'E310 + Personal Cup Adapter',
          price: '499.95',
          colors: 'Black,Red,Slate',
          image: './media_91e13e23df6a86dc165b258726dc061fb3a30427.png',
          description: '',
          series: 'Explorian Series',
          variantSkus: '065971-VB,066071-VB,065755-VB',
        },
        {
          parentSku: 'vbnde310',
          sku: '065971-VB',
          title: 'E310 Black',
          price: '499.95',
        },
        {
          parentSku: 'vbnde310',
          sku: '066071-VB',
          title: 'E310 Red',
          price: '499.95',
          image: './media_b5c889e055c690555d34d09fd6ac1880371f87eb.jpg',
        },
        {
          parentSku: 'vbnde310',
          sku: '065755-VB',
          title: 'E310 Slate',
          price: '499.95',
          image: './media_b4070b91e8066da94cb7b79bd38f9bdbec1faf09.jpg',
        },
        {
          sku: '5-speed-immersion-blender-4-piece-deluxe-bundle',
          urlKey: '4-piece-deluxe-immersion-blender-bundle',
          title: '5-Speed Immersion Blender 4-Piece Deluxe Bundle',
          price: '259.95',
          colors: 'Black,Red,White',
          image: './media_1d6e626b671d68ca698e975223bd5d46ff0200d5.png',
          description: '4-Piece Deluxe Immersion Blender Bundle ',
          variantSkus: '071239,073791,073792',
        },
        {
          parentSku: '5-speed-immersion-blender-4-piece-deluxe-bundle',
          sku: '071239',
          title: '4-Piece Deluxe Immersion Blender Bundle-Black',
          price: '259.95',
          image: './media_7c70eae5f43e8c9aa20bb33a0b2e9fe938c7c8a4.png',
        },
        {
          parentSku: '5-speed-immersion-blender-4-piece-deluxe-bundle',
          sku: '073791',
          title: '4-Piece Deluxe Immersion Blender Bundle-Red',
          price: '259.95',
          image: './media_d269f206ec3190ef9793666e0bf1d681a72717ac.jpg',
        },
        {
          parentSku: '5-speed-immersion-blender-4-piece-deluxe-bundle',
          sku: '073792',
          title: '4-Piece Deluxe Immersion Blender Bundle-White',
          price: '259.95',
          image: './media_87e27c4d4fb78252924d8d730191bbdecb37edcd.jpg',
        },
        {
          sku: 'vbndp750',
          urlKey: 'propel-750-classic-bundle',
          title: 'Propel 750 Classic Bundle',
          price: '699.95',
          colors: 'Black,Red,White,Slate',
          image: './media_a23f38b19963cb654697ab73b10ce843c5d92b67.jpg',
          description: '',
          series: 'Propel Series',
          variantSkus: '071395-VB,073294-VB,073295-VB,073296-VB',
        },
        {
          parentSku: 'vbndp750',
          sku: '071395-VB',
          title: 'Propel Series 750 Black',
          price: '699.95',
          image: './media_da2da61a3412c3f8ed311a10ce1d30147f7673e0.jpg',
        },
        {
          parentSku: 'vbndp750',
          sku: '073294-VB',
          title: 'Propel Series 750 Red',
          price: '699.95',
          image: './media_4e9ffc439f66cc5e662721dd501d506e0b86dcfa.png',
        },
        {
          parentSku: 'vbndp750',
          sku: '073295-VB',
          title: 'Propel Series 750 White',
          price: '699.95',
          image: './media_462badead7c64b4ac3d890e2353c3353fa76dbec.png',
        },
        {
          parentSku: 'vbndp750',
          sku: '073296-VB',
          title: 'Propel Series 750 Slate',
          price: '699.95',
          image: './media_289ac0dd71906308849bf789920c2e7414b303cf.png',
        },
        {
          sku: '5-speed-immersion-blender',
          urlKey: '5-speed-immersion-blender',
          title: '5-Speed Immersion Blender',
          price: '169.95',
          colors: 'Black,White',
          image: './media_e462565d4fe5c0b436207995a7512a8550f360fd.jpg',
          description: '',
          series: 'Immersion',
          variantSkus: '067991,074051',
        },
        {
          parentSku: '5-speed-immersion-blender',
          sku: '067991',
          title: 'Vitamix Immersion Blender-Black',
          price: '169.95',
          image: './media_bffe56dc2da48744128a4babed392e2e3b44b423.png',
        },
        {
          parentSku: '5-speed-immersion-blender',
          sku: '074051',
          title: 'Vitamix Immersion Blender-White',
          price: '169.95',
          image: './media_fd209a85703900becf33e13e7d6a348b00123379.png',
        },
        {
          sku: 'ascent-x4',
          urlKey: 'ascent-x4',
          title: 'Ascent® X4',
          price: '699.95',
          colors: 'Brushed Stainless Metal Finish,Black Stainless Metal Finish,Graphite Metal Finish,Polar White',
          image: './media_8bddd55210bdb666146ce6fa5a414d78f746c9a7.png',
          description: '',
          series: 'Ascent X Series',
          variantSkus: '073494-04,074100-04,074101-04,074102-04',
        },
        {
          parentSku: 'ascent-x4',
          sku: '073494-04',
          title: 'Ascent X4-Brushed Stainless Metal Finish',
          price: '699.95',
          image: './media_d277e72e9c7730679dc59fc6d5df8758728ac1d3.jpg',
        },
        {
          parentSku: 'ascent-x4',
          sku: '074100-04',
          title: 'Ascent X4-Black Stainless Metal Finish',
          price: '699.95',
          image: './media_585faa6a718633cc9cbe1f4d280acce15fecf842.jpg',
        },
        {
          parentSku: 'ascent-x4',
          sku: '074101-04',
          title: 'Ascent X4-Graphite Metal Finish',
          price: '699.95',
          image: './media_171f830dfba33ae5e80c0cb58014b2ab0a3d6a40.jpg',
        },
        {
          parentSku: 'ascent-x4',
          sku: '074102-04',
          title: 'Ascent X4-Polar White',
          price: '699.95',
          image: './media_eb0db244655306781fc24e21dd40a4c7ded43f55.png',
        },
        {
          sku: 'e310',
          urlKey: 'e310',
          title: 'E310',
          price: '379.95',
          colors: 'Black,Red,Slate',
          image: './media_6892d8aa6dee6d15d6fca585526990a6aecf864f.jpg',
          description: '',
          series: 'Explorian Series',
          variantSkus: '065971,066071,065755',
        },
        {
          parentSku: 'e310',
          sku: '065971',
          title: 'E310 Black',
          price: '379.95',
        },
        {
          parentSku: 'e310',
          sku: '066071',
          title: 'E310 Red',
          price: '379.95',
          image: './media_b5c889e055c690555d34d09fd6ac1880371f87eb.jpg',
        },
        {
          parentSku: 'e310',
          sku: '065755',
          title: 'E310 Slate',
          price: '379.95',
          image: './media_b4070b91e8066da94cb7b79bd38f9bdbec1faf09.jpg',
        },
        {
          sku: '5-speed-immersion-blender-3-piece-bundle',
          urlKey: '5-speed-immersion-blender-3-piece-bundle',
          title: '5-Speed Immersion Blender 3-Piece Bundle',
          price: '189.95',
          colors: 'Black',
          image: './media_e462565d4fe5c0b436207995a7512a8550f360fd.png',
          description: '',
          series: 'Immersion',
          variantSkus: '071238',
        },
        {
          parentSku: '5-speed-immersion-blender-3-piece-bundle',
          sku: '071238',
          title: '5-Speed Immersion Blender 3-Piece Bundle-Black',
          price: '189.95',
          image: './media_8a82902bdc81f389fe13e9ceaf7c60984fcb06f5.jpg',
        },
        {
          sku: 'a2300',
          urlKey: 'a2300',
          title: 'A2300',
          price: '399.95',
          colors: 'Black,Red,White,Slate',
          image: './media_13f34abcff863c53e25028911749e9a9d1d6f1c4.jpg',
          description: '',
          series: 'Ascent Series',
          variantSkus: '061006,062047,062049,062326',
        },
        {
          parentSku: 'a2300',
          sku: '061006',
          title: 'A2300 Black US',
          price: '399.95',
          image: './media_13f34abcff863c53e25028911749e9a9d1d6f1c4.jpg',
        },
        {
          parentSku: 'a2300',
          sku: '062047',
          title: 'A2300 Red US',
          price: '399.95',
          image: './media_a378c3b84062ab2631361994fb52f68090b7ecd6.jpg',
        },
        {
          parentSku: 'a2300',
          sku: '062049',
          title: 'A2300 White US',
          price: '399.95',
          image: './media_5ad686c41788061ad405b9d1119826d389628951.jpg',
        },
        {
          parentSku: 'a2300',
          sku: '062326',
          title: 'A2300 Slate US/CA',
          price: '399.95',
          image: './media_388262d85b810d60aae9aacf4acf19c3f4d3f3b3.jpg',
        },
        {
          sku: 'certified-reconditioned-explorian-series',
          urlKey: 'certified-reconditioned-explorian',
          title: 'Certified Reconditioned Explorian™ Series',
          price: '269.95',
          colors: 'Black,Red',
          image: './media_f78714bc941f32219cd63190db257670439af20a.jpg',
          description: '',
          variantSkus: '065542,065543',
        },
        {
          parentSku: 'certified-reconditioned-explorian-series',
          sku: '065542',
          title: 'Certified Reconditioned Explorian Series Black',
          price: '269.95',
          image: './media_408d41561b90b337412062fa74af7d3080f9e158.jpg',
        },
        {
          parentSku: 'certified-reconditioned-explorian-series',
          sku: '065543',
          title: 'Certified Reconditioned Explorian Series Red',
          price: '269.95',
          image: './media_ac88dc6c27b6adb4fbe342c639735c83b6688a35.jpg',
        },
        {
          sku: 'certified-reconditioned-standard',
          urlKey: 'certified-reconditioned-standard',
          title: 'Certified Reconditioned Standard',
          price: '349.95',
          colors: 'Black',
          image: './media_0185f10238249fd92247bd8dc1eca67e851612cc.jpg',
          description: '',
          variantSkus: '001811',
        },
        {
          parentSku: 'certified-reconditioned-standard',
          sku: '001811',
          title: 'Certified Reconditioned Standard Black',
          price: '349.95',
          image: './media_0185f10238249fd92247bd8dc1eca67e851612cc.jpg',
        },
        {
          sku: 'certified-reconditioned-explorian-with-programs',
          urlKey: 'certified-reconditioned-explorian-with-programs',
          title: 'Certified Reconditioned Explorian with Programs',
          price: '279.95',
          colors: 'Black,Slate',
          image: './media_62fbd51d66bbc590122c5350d81563babd81caff.png',
          description: '',
          series: 'Explorian Series',
          variantSkus: '072611,072612',
        },
        {
          parentSku: 'certified-reconditioned-explorian-with-programs',
          sku: '072611',
          title: 'Certified Reconditioned Explorian with Programs-Black',
          price: '279.95',
          image: './media_d0eaed3e681e355e67c38d02b2eb6b41a3398917.png',
        },
        {
          parentSku: 'certified-reconditioned-explorian-with-programs',
          sku: '072612',
          title: 'Certified Reconditioned Explorian with Programs-Slate',
          price: '279.95',
          image: './media_a496f32fb66c9c3e5419e0b1309c5990841ddc38.png',
        },
        {
          sku: 'certified-reconditioned-a2500',
          urlKey: 'certified-reconditioned-a2500',
          title: 'Certified Reconditioned A2500',
          price: '349.95',
          colors: 'Black,Red,White,Slate',
          image: './media_b0c62316e4e7d579b54ffcf58e0e047a1e14d922.jpg',
          description: '',
          variantSkus: '065942,065943,065945,065944',
        },
        {
          parentSku: 'certified-reconditioned-a2500',
          sku: '065942',
          title: 'Certified Reconditioned A2500 Black',
          price: '349.95',
          image: './media_085c82042636dead23dbd72970803237c7d7a2ae.jpg',
        },
        {
          parentSku: 'certified-reconditioned-a2500',
          sku: '065943',
          title: 'Certified Reconditioned A2500 Red',
          price: '349.95',
          image: './media_cfae20a1aeb34e2b9a5eb3f97599877f9ef617e4.jpg',
        },
        {
          parentSku: 'certified-reconditioned-a2500',
          sku: '065945',
          title: 'Certified Reconditioned A2500 White',
          price: '349.95',
          image: './media_02420ba40543181cefaf736d243b62f46ba86767.jpg',
        },
        {
          parentSku: 'certified-reconditioned-a2500',
          sku: '065944',
          title: 'Certified Reconditioned A2500 Slate',
          price: '349.95',
          image: './media_72b36534abcb088ef28eee301fec7938e7543f22.jpg',
        },
        {
          sku: 'certified-reconditioned-a3500',
          urlKey: 'certified-reconditioned-a3500',
          title: 'Certified Reconditioned A3500',
          price: '449.95',
          colors: 'Brushed Stainless Metal Finish,White,Black Stainless Metal Finish,Graphite Metal Finish',
          image: './media_d67c6773e0c25870633ce63971b4b87449151ff9.jpg',
          description: '',
          series: 'Ascent Series',
          variantSkus: '065946,066911,065948,065949',
        },
        {
          parentSku: 'certified-reconditioned-a3500',
          sku: '065946',
          title: 'Certified Reconditioned A3500 BSM',
          price: '449.95',
          image: './media_892a5d5aefae9abeeb5ba9e84a5c21a183e3c40e.jpg',
        },
        {
          parentSku: 'certified-reconditioned-a3500',
          sku: '066911',
          title: 'Certified Reconditioned A3500 White',
          price: '449.95',
          image: './media_8ced67e4ba1ff91ab336c30418e866373436fd74.jpg',
        },
        {
          parentSku: 'certified-reconditioned-a3500',
          sku: '065948',
          title: 'Certified Reconditioned A3500 Black Stainless',
          price: '449.95',
          image: './media_35aa0db6d777e331c630ed1aaa041c2f5f08fd30.jpg',
        },
        {
          parentSku: 'certified-reconditioned-a3500',
          sku: '065949',
          title: 'Certified Reconditioned A3500 Graphite',
          price: '449.95',
          image: './media_33c52f77dbdf939e89a40c893e0d224f780ca9ac.jpg',
        },
        {
          sku: 'certified-reconditioned-propel-750',
          urlKey: 'certified-reconditioned-propel-750',
          title: 'Certified Reconditioned Propel 750',
          price: '399.95',
          colors: 'Black',
          image: './media_3c2bd80cbeededcb3bb3f4cd57c82ce7a8c3c353.png',
          description: '',
          variantSkus: '074592',
        },
        {
          parentSku: 'certified-reconditioned-propel-750',
          sku: '074592',
          title: 'Certified Reconditioned Propel 750-Black',
          price: '399.95',
          image: './media_7e94e5e540bdf401636579281016f4c1509571d8.png',
        },
        {
          sku: 'x4-kitchen-system',
          urlKey: 'ascent-x4-gourmet-smartprep-kitchen-system',
          title: 'Ascent® X4 Gourmet SmartPrep Kitchen System',
          price: '899.95',
          colors: 'Polar White',
          image: './media_708933f81662a2efc1b3891a450414e6a2adb34a.png',
          description: '',
          series: 'Ascent X Series',
          variantSkus: '075708-100',
        },
        {
          parentSku: 'x4-kitchen-system',
          sku: '075708-100',
          title: 'Ascent® X4 Gourmet SmartPrep Kitchen System-Polar White',
          price: '899.95',
          image: './media_9d1e9401bd788b2df6d8a5c79a710cca2eac16f3.jpg',
        },
        {
          sku: 'certified-reconditioned-5300',
          urlKey: 'certified-reconditioned-5300',
          title: 'Certified Reconditioned 5300',
          price: '269.95',
          colors: 'Black,Red',
          image: './media_ae1e6523742b57432897737fa7f2b1a6abeafd9e.jpg',
          description: '',
          variantSkus: '058544,058545',
        },
        {
          parentSku: 'certified-reconditioned-5300',
          sku: '058544',
          title: 'Certified Reconditioned 5300 Black',
          price: '269.95',
          image: './media_ae1e6523742b57432897737fa7f2b1a6abeafd9e.jpg',
        },
        {
          parentSku: 'certified-reconditioned-5300',
          sku: '058545',
          title: 'Certified Reconditioned 5300  Red',
          price: '269.95',
          image: './media_fb97ecf636a7c5b0ab9fb8092e33a91ce071e383.jpg',
        },
      ],
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      // 'cache-control': 'max-age=7200, must-revalidate',
      'content-type': 'application/json',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
    });
  });

  it('sends 400 for non json path', async () => {
    const state = DEFAULT_STATE({
      path: '/blog/index',
    });
    const result = await productIndexPipe(state, new PipelineRequest('https://acme.com/products/'));
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'only json resources supported.');
  });

  it('handles a 404', async () => {
    const state = DEFAULT_STATE({
      path: '/products/index.json',
    });
    state.info = getPathInfo('/products/index.json');

    const result = await productIndexPipe(state, new PipelineRequest(new URL('https://acme.com/products/index.json?id=404')));
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'failed to load adobe/helix-pages/main/default/index/404.json from product-bus: 404');
  });

  it('returns 404 for invalid path info', async () => {
    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/product-configurable.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = false;

    const result = await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/product-configurable.json')),
    );
    assert.strictEqual(result.status, 404);
    assert.strictEqual(result.headers.get('x-error'), 'invalid path');
  });

  it('sets state type to index', async () => {
    const s3Loader = new FileS3Loader();

    const state = DEFAULT_STATE({
      log: console,
      s3Loader,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');
    await productIndexPipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );
    assert.strictEqual(state.type, 'index');
  });

  it('returns early when res.error is set but res.status is less than 400', async () => {
    // Mock fetchContent to set res.error and res.status < 400
    const { productIndexPipe: pipe } = await esmock('../src/product-index-pipe.js', {
      '../src/steps/fetch-content.js': {
        default: async (state, req, res) => {
          res.error = 'Some non-critical error';
          res.status = 200; // Status less than 400
        },
      },
    });

    const state = DEFAULT_STATE({
      log: console,
      ref: 'main',
      path: '/products/index.json',
      partition: 'live',
      timer: {
        update: () => { },
      },
    });
    state.info = getPathInfo('/products/index.json');

    const result = await pipe(
      state,
      new PipelineRequest(new URL('https://acme.com/products/index.json')),
    );

    // Should return early without throwing PipelineStatusError
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.error, 'Some non-critical error');
    // Should not have gone through the full pipeline (no JSON body, no cache headers)
    assert.strictEqual(result.body, '');
  });

  describe('toSpreadsheet', () => {
    it('returns a spreadsheet', () => {
      const spreadsheet = toSpreadsheet({
        vbndax5ks: {
          urlKey: 'ascent-x5-smartprep-kitchen-system',
          title: 'Ascent® X5 SmartPrep™ Kitchen System',
          price: '949.95',
          image: './media_20b43ff4abb1e54666eb0fa736b1343ac894a794.jpg',
          description: '',
          series: 'Ascent X Series',
          variants: {
            '073495-04-VB': {
              title: 'Ascent X5-Brushed Stainless Metal Finish',
              price: '949.95',
              image: './media_a7274c9d79252baba87664333cf9400a9e9e7035.jpg',
            },
            '074104-04-VB': {
              title: 'Ascent X5-Graphite Metal Finish',
              price: '949.95',
              image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
            },
          },
          colors: 'Brushed Stainless Metal Finish,Black',
        },
        'x2-kitchen-system': {
          urlKey: 'ascent-x2-smartprep-kitchen-system',
          title: 'Ascent® X2 SmartPrep Kitchen System',
          price: '749.95',
          colors: 'Shadow Black',
          image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
          description: '',
          series: 'Ascent X Series',
          variants: {
            '075710-100': {
              title: 'Ascent® X2 SmartPrep Kitchen System-Shadow Black',
              price: '749.95',
              image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
            },
          },
        },
        'ascent-x5': {
          urlKey: 'ascent-x5',
          title: 'Ascent® X5',
          price: '749.95',
          colors: 'Brushed Stainless Metal Finish,Graphite Metal Finish',
          image: './media_7bacc89abbcd1d51e8395fd123cdd3c5d5a3d057.png',
          description: '',
          series: 'Ascent X Series',
          variants: {
            '073495-04': {
              title: 'Ascent X5-Brushed Stainless Metal Finish',
              price: '749.95',
              image: './media_caee0cae83d8cb8fba9d445b91c91574c4a05e34.jpg',
            },
            '074104-04': {
              title: 'Ascent® X5-Graphite Metal Finish',
              price: '749.95',
              image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
            },
          },
        },
      });
      assert.deepStrictEqual(spreadsheet, {
        ':type': 'sheet',
        columns: [
          'sku',
          'urlKey',
          'title',
          'price',
          'image',
          'description',
          'series',
          'colors',
          'parentSku',
          'variantSkus',
        ],
        data: [
          {
            sku: 'vbndax5ks',
            urlKey: 'ascent-x5-smartprep-kitchen-system',
            title: 'Ascent® X5 SmartPrep™ Kitchen System',
            price: '949.95',
            image: './media_20b43ff4abb1e54666eb0fa736b1343ac894a794.jpg',
            description: '',
            series: 'Ascent X Series',
            variants: undefined,
            colors: 'Brushed Stainless Metal Finish,Black',
            variantSkus: '073495-04-VB,074104-04-VB',
          },
          {
            parentSku: 'vbndax5ks',
            sku: '073495-04-VB',
            title: 'Ascent X5-Brushed Stainless Metal Finish',
            price: '949.95',
            image: './media_a7274c9d79252baba87664333cf9400a9e9e7035.jpg',
          },
          {
            parentSku: 'vbndax5ks',
            sku: '074104-04-VB',
            title: 'Ascent X5-Graphite Metal Finish',
            price: '949.95',
            image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
          },
          {
            sku: 'x2-kitchen-system',
            urlKey: 'ascent-x2-smartprep-kitchen-system',
            title: 'Ascent® X2 SmartPrep Kitchen System',
            price: '749.95',
            colors: 'Shadow Black',
            image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
            description: '',
            series: 'Ascent X Series',
            variants: undefined,
            variantSkus: '075710-100',
          },
          {
            parentSku: 'x2-kitchen-system',
            sku: '075710-100',
            title: 'Ascent® X2 SmartPrep Kitchen System-Shadow Black',
            price: '749.95',
            image: './media_42814a23e6b2d867123d19097af62a27234991ab.jpg',
          },
          {
            sku: 'ascent-x5',
            urlKey: 'ascent-x5',
            title: 'Ascent® X5',
            price: '749.95',
            colors: 'Brushed Stainless Metal Finish,Graphite Metal Finish',
            image: './media_7bacc89abbcd1d51e8395fd123cdd3c5d5a3d057.png',
            description: '',
            series: 'Ascent X Series',
            variants: undefined,
            variantSkus: '073495-04,074104-04',
          },
          {
            parentSku: 'ascent-x5',
            sku: '073495-04',
            title: 'Ascent X5-Brushed Stainless Metal Finish',
            price: '749.95',
            image: './media_caee0cae83d8cb8fba9d445b91c91574c4a05e34.jpg',
          },
          {
            parentSku: 'ascent-x5',
            sku: '074104-04',
            title: 'Ascent® X5-Graphite Metal Finish',
            price: '749.95',
            image: './media_2e1b9f1b8aeb6c9c53a8dc1726d56c40604f5b39.png',
          },
        ],
      });
    });
  });
});
