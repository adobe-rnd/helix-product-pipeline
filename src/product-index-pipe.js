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
import fetchProductBusContent from './steps/fetch-productbus.js';
import { setLastModified } from './utils/last-modified.js';
import { set404CacheHeaders, setIndexCacheHeaders } from './steps/set-cache-headers.js';
import { getIncludes, getPaginationParams } from './steps/utils.js';
import { fetchCatalogPriceRules } from './steps/fetch-price-rules.js';
import { applyCatalogPriceRules } from './steps/apply-price-rules.js';
import { toStreamBody } from './utils/body.js';

/**
 * Keys of the index entries to list, in output order.
 * @param {SharedTypes.StoredIndex} index
 * @param {Record<string, boolean>} includes
 * @returns {string[]}
 */
function listedKeys(index, includes) {
  return Object.keys(index)
    .sort((a, b) => a.localeCompare(b))
    .filter((key) => includes.all || !index[key].filters?.noindex || includes.noindex);
}

/**
 * @param {any} product
 * @returns {[string, any][]} the product's variants, if any
 */
function variantEntries(product) {
  return typeof product.variants === 'object' && product.variants !== null
    ? Object.entries(product.variants)
    : [];
}

/**
 * Columns and row count of the listed entries, without building rows.
 * @param {SharedTypes.StoredIndex} index
 * @param {string[]} keys
 * @returns {{ columns: string[], total: number }}
 */
function scan(index, keys) {
  const columns = new Set(['sku']);
  let total = 0;
  for (const key of keys) {
    const product = index[key].data;
    Object.keys(product).forEach((k) => {
      if (k !== 'variants') {
        columns.add(k);
      }
    });
    total += 1;
    const variants = variantEntries(product);
    if (variants.length) {
      columns.add('parentSku');
      columns.add('variantSkus');
      variants.forEach(([, variant]) => {
        Object.keys(variant).forEach((k) => columns.add(k));
      });
      total += variants.length;
    }
  }
  return { columns: Array.from(columns), total };
}

/**
 * The rows of one entry: the product, then a row per variant.
 * @param {string} sluggedSku
 * @param {any} product
 * @returns {Record<string, any>[]}
 */
function entryRows(sluggedSku, product) {
  const sku = product.sku ?? sluggedSku;
  const records = [{
    sku,
    ...product,
    variants: undefined,
  }];
  const variants = variantEntries(product);
  if (variants.length) {
    const variantSkus = [];
    variants.forEach(([vSluggedSku, variant]) => {
      const variantSku = variant.sku ?? vSluggedSku;
      variantSkus.push(variantSku);
      records.push({
        parentSku: sku,
        sku: variantSku,
        ...variant,
      });
    });
    records[0].variantSkus = variantSkus.join(',');
  }
  return records;
}

/**
 * Rows `start` (inclusive) to `end` (exclusive). Only entries in that range
 * get row objects.
 * @param {SharedTypes.StoredIndex} index
 * @param {string[]} keys
 * @param {number} start
 * @param {number} end
 * @returns {Generator<Record<string, any>>}
 */
function* rowsInRange(index, keys, start, end) {
  let pos = 0;
  for (const key of keys) {
    if (pos >= end) {
      return;
    }
    const product = index[key].data;
    const count = 1 + variantEntries(product).length;
    if (pos + count <= start) {
      pos += count;
    } else {
      for (const row of entryRows(key, product)) {
        if (pos >= start && pos < end) {
          yield row;
        }
        pos += 1;
      }
    }
  }
}

/**
 * @param {SharedTypes.StoredIndex} index
 * @param {Record<string, boolean>} includes
 * @param {{ hasParams?: boolean, limit?: number, offset?: number }} pagination
 */
function sheet(index, includes, pagination) {
  const {
    limit = pagination.hasParams ? 1000 : Infinity,
    offset = 0,
  } = pagination;
  const keys = listedKeys(index, includes);
  const { columns, total } = scan(index, keys);
  const len = Math.max(0, Math.min(limit, total - offset));
  return {
    header: {
      ':type': /** @type {'sheet'} */ ('sheet'),
      total,
      offset,
      limit: len,
      columns,
    },
    rows: () => rowsInRange(index, keys, offset, offset + len),
  };
}

/**
 * Returns index as spreadsheet with pagination support.
 * @param {SharedTypes.StoredIndex} index
 * @param {Record<string, boolean>} includes
 * @param {{ hasParams?: boolean, limit?: number, offset?: number }} [pagination={}]
 *   - Pagination options
 * @returns {{
*   ':type': 'sheet',
*   total: number,
*   offset: number,
*   limit: number,
*   columns: string[],
*   data: Record<string, string>[]
* }}
*/
export function toSpreadsheet(index, includes, pagination = {}) {
  const { header, rows } = sheet(index, includes, pagination);
  return { ...header, data: [...rows()] };
}

/**
 * The spreadsheet as JSON text parts, identical to
 * `JSON.stringify(toSpreadsheet(...), null, 2)`, one row at a time.
 *
 * The keys, columns and total are computed right away (so a malformed index
 * fails here, inside the pipe); only the rows are rendered lazily.
 * @param {SharedTypes.StoredIndex} index
 * @param {Record<string, boolean>} includes
 * @param {{ hasParams?: boolean, limit?: number, offset?: number }} [pagination={}]
 * @returns {Generator<string>}
 */
export function toSpreadsheetJSON(index, includes, pagination = {}) {
  const { header, rows } = sheet(index, includes, pagination);
  const head = JSON.stringify(header, null, 2);
  return (function* parts() {
    yield `${head.slice(0, -2)},\n  "data": [`;
    let first = true;
    for (const row of rows()) {
      yield `${first ? '' : ','}\n    ${JSON.stringify(row, null, 2).replace(/\n/g, '\n    ')}`;
      first = false;
    }
    yield first ? ']\n}' : '\n  ]\n}';
  }());
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
    await fetchProductBusContent(state, req, res);
    if (res.error) {
      if (res.status < 400) {
        return res;
      }
      throw new PipelineStatusError(res.status, res.error);
    }

    await fetchCatalogPriceRules(state, req);
    await setIndexCacheHeaders(state, req, res);
    applyCatalogPriceRules(state, res);

    setLastModified(state, res);

    const pagination = getPaginationParams(req);
    res.body = toStreamBody(
      toSpreadsheetJSON(state.content.data, getIncludes(req), pagination),
      { log, name: 'index' },
    );
  } catch (e) {
    const errorRes = new PipelineResponse('', {
      /* c8 ignore next 6 */
      status: e instanceof PipelineStatusError ? e.code : 500,
      headers: {
        'x-error': cleanupHeaderValue(e.message),
      },
    });
    const level = errorRes.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${errorRes.status} ${e.message}`, e);
    errorRes.body = '';
    if (errorRes.status === 404) {
      await set404CacheHeaders(state, req, errorRes);
    }
    return errorRes;
  }

  return res;
}
