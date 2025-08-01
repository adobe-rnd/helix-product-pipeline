/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { PipelineResponse, PipelineStatusError } from '@adobe/helix-html-pipeline';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { validatePathInfo } from './utils/path.js';
import initConfig from './steps/init-config.js';
import fetchContent from './steps/fetch-content.js';
import { setLastModified } from './utils/last-modified.js';
import { compute404Keys } from './steps/set-cache-headers.js';

/**
 * Returns index as spreadsheet
 * @param {StoredIndex} index
 * @returns {{
*   ':type': 'sheet',
*   columns: string[],
*   data: Record<string, string>[]
* }}
*/
export function toSpreadsheet(index) {
  const columns = new Set(['sku']);

  const products = Object.entries(index).reduce((acc, [sku, product]) => {
    // add each property to columns if not already present
    Object.keys(product).forEach((key) => {
      if (key !== 'variants') {
        columns.add(key);
      }
    });
    // return the row, include sku as property
    const records = [{
      sku,
      ...product,
      variants: undefined,
    }];

    // add a row for each variant, if any
    if (typeof product.variants === 'object' && product.variants !== null) {
      const variants = Object.entries(product.variants);

      if (variants.length) {
        const variantSkus = [];
        variants.forEach(([variantSku, variant]) => {
          Object.keys(variant).forEach((key) => {
            columns.add(key);
          });
          variantSkus.push(variantSku);
          records.push({
            parentSku: sku,
            sku: variantSku,
            ...variant,
          });
        });

        records[0].variantSkus = variantSkus.join(',');
      }
    }

    acc.push(...records);
    return acc;
  }, []);

  return {
    ':type': 'sheet',
    columns: Array.from(columns),
    data: products,
  };
}

export async function productIndexPipe(state, req) {
  const { log, info } = state;
  const { extension } = info;
  state.type = 'index';

  if (!validatePathInfo(state.info)) {
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': 'invalid path',
      },
    });
  }

  if (extension !== '.json') {
    log.error('only json resources supported.');
    return new PipelineResponse('', {
      status: 400,
      headers: {
        'x-error': 'only json resources supported.',
      },
    });
  }

  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'application/json',
    },
  });

  try {
    await initConfig(state, req, res);

    state.timer?.update('content-fetch');
    await fetchContent(state, req, res);
    if (res.error) {
      if (res.status < 400) {
        return res;
      }
      throw new PipelineStatusError(res.status, res.error);
    }

    // TODO: set surrogate keys
    // const keys = await computeJSONSurrogateKeys(state);
    // setCachingHeaders(state, req, res, keys);

    setLastModified(state, res);

    res.body = JSON.stringify(toSpreadsheet(state.content.data), null, 2);
  } catch (e) {
    const errorRes = new PipelineResponse('', {
      /* c8 ignore next 3 */
      status: e instanceof PipelineStatusError ? e.code : 500,
    });
    const level = errorRes.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${errorRes.status} ${e.message}`, e);
    errorRes.body = '';
    errorRes.headers.set('x-error', cleanupHeaderValue(e.message));
    if (errorRes.status === 404) {
      const keys = await compute404Keys(state);
      errorRes.headers.set('x-surrogate-key', keys.join(' '));
    }
    return errorRes;
  }

  return res;
}
