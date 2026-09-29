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

/* eslint-disable no-continue */

import { recordLastModified } from '../utils/last-modified.js';

/**
 * @param {{ enabled?: boolean, start?: string, end?: string }} rule
 * @param {number} now
 * @returns {boolean}
 */
function isActive(rule, now) {
  // A rule is enabled unless explicitly disabled (absent flag = enabled).
  if (rule.enabled === false) return false;
  if (rule.start && new Date(rule.start).getTime() > now) return false;
  if (rule.end && new Date(rule.end).getTime() < now) return false;
  return true;
}

/**
 * @param {Record<string, any> | undefined} properties
 * @param {string} sourceKey
 * @returns {string[]}
 */
function getMappedFields(properties, sourceKey) {
  if (!properties || typeof properties !== 'object') {
    return [];
  }
  return Object.entries(properties)
    .filter(([key, value]) => key === sourceKey && typeof value === 'string')
    .map(([_, value]) => value)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

/**
 * Use the legacy flat `price` field only when it is not explicitly mapped from
 * `price.regular`. If it is, treating it as a final-price column would corrupt
 * the stored regular price when promotions are applied.
 *
 * @param {Record<string, any> | undefined} properties
 * @returns {string[]}
 */
function getLegacyIndexPriceFallback(properties) {
  return getMappedFields(properties, 'price.regular').includes('price') ? [] : ['price'];
}

/**
 * Resolve the index columns that carry the final and regular price for products
 * and variants. Mirrors the indexer config model: variants use
 * `properties.variants ?? properties`. When no explicit `price.final` mapping
 * exists, fall back to the legacy `price` column so existing indices keep
 * working.
 *
 * @param {PipelineState} state
 * @returns {{
 *   final: { product: string[], variant: string[] },
 *   regular: { product: string[], variant: string[] },
 * }}
 */
function getIndexPriceTargets(state) {
  const properties = state.config?.public?.productIndexerConfig?.properties;
  const variantProperties = properties?.variants ?? properties;
  const productFinal = getMappedFields(properties, 'price.final');
  const variantFinal = getMappedFields(variantProperties, 'price.final');
  return {
    final: {
      product: productFinal.length ? productFinal : getLegacyIndexPriceFallback(properties),
      variant: variantFinal.length ? variantFinal : getLegacyIndexPriceFallback(variantProperties),
    },
    regular: {
      product: getMappedFields(properties, 'price.regular'),
      variant: getMappedFields(variantProperties, 'price.regular'),
    },
  };
}

/**
 * @param {object} record
 * @param {string[]} fields
 * @returns {number}
 */
function getCurrentIndexPrice(record, fields) {
  const prices = fields
    .map((field) => parseFloat(record?.[field]))
    .filter((price) => !Number.isNaN(price));
  return prices.length ? Math.min(...prices) : NaN;
}

/**
 * @param {object} record
 * @param {string[]} fields
 * @param {string} price
 */
function setIndexPrice(record, fields, price) {
  fields.forEach((field) => {
    record[field] = price;
  });
}

/**
 * @param {object} record
 * @param {string[]} fields
 * @returns {string | undefined}
 */
function getIndexFieldValue(record, fields) {
  return fields.find((field) => record?.[field] != null)
    ? String(record[fields.find((field) => record?.[field] != null)])
    : undefined;
}

/**
 * @param {object} product
 * @returns {SharedTypes.ProductBusVariant[]}
 */
function getVariantList(product) {
  if (Array.isArray(product.variants)) {
    return product.variants;
  }
  if (product.variants) {
    return Object.values(product.variants);
  }
  return [];
}

/**
 * @param {object} record
 * @param {boolean} isIndex
 * @param {{
 *   final: { product: string[], variant: string[] },
 *   regular: { product: string[], variant: string[] },
 * }} indexPriceTargets
 * @param {boolean} isVariant
 * @returns {{
 *   finalAmount: number,
 *   regularAmount: number,
 *   regularRaw: string | undefined,
 *   setFinal: (price: string) => void,
 * }}
 */
function getPriceInfo(record, isIndex, indexPriceTargets, isVariant = false) {
  if (isIndex) {
    const finalFields = isVariant
      ? indexPriceTargets.final.variant
      : indexPriceTargets.final.product;
    const regularFields = isVariant
      ? indexPriceTargets.regular.variant
      : indexPriceTargets.regular.product;
    return {
      finalAmount: getCurrentIndexPrice(record, finalFields),
      regularAmount: parseFloat(getIndexFieldValue(record, regularFields)),
      regularRaw: getIndexFieldValue(record, regularFields),
      setFinal: (price) => setIndexPrice(record, finalFields, price),
    };
  }

  return {
    finalAmount: parseFloat(record.price?.final),
    regularAmount: parseFloat(record.price?.regular),
    regularRaw: record.price?.regular,
    setFinal: (price) => {
      if (record.price) {
        record.price.final = price;
      }
    },
  };
}

/**
 * @param {SharedTypes.CatalogPriceRule} rule
 * @param {SharedTypes.CatalogPriceRule['variants'][string] | undefined} variantRule
 * @param {number} now
 * @param {{ regularAmount: number, regularRaw: string | undefined }} priceInfo
 * @returns {{ amount: number, raw: string } | null}
 */
function getCandidatePrice(rule, variantRule, now, priceInfo) {
  let raw;
  let amount;

  if (variantRule && isActive(variantRule, now)) {
    if (variantRule.price == null) {
      return null;
    }
    raw = String(variantRule.price);
    amount = parseFloat(variantRule.price);
  } else if (rule.price != null) {
    raw = String(rule.price);
    amount = parseFloat(rule.price);
  } else {
    return null;
  }

  if (Number.isNaN(amount)) {
    return null;
  }

  if (!Number.isNaN(priceInfo.regularAmount) && amount > priceInfo.regularAmount) {
    return {
      amount: priceInfo.regularAmount,
      raw: priceInfo.regularRaw,
    };
  }

  return { amount, raw };
}

/**
 * Apply one catalog price rule to a product object.
 * In product mode, mutates `price.final`; in index mode, mutates the column(s)
 * mapped from `price.final` (falling back to the legacy flat `price` field).
 * Each SKU is evaluated independently: an active variant override replaces the
 * parent candidate for that SKU, otherwise the parent rule price is inherited.
 *
 * @param {object} product
 * @param {SharedTypes.CatalogPriceRule} rule
 * @param {number} now
 * @param {boolean} isIndex
 * @param {{
 *   final: { product: string[], variant: string[] },
 *   regular: { product: string[], variant: string[] },
 * }} [indexPriceTargets]
 */
function applyRuleToProduct(product, rule, now, isIndex = false, indexPriceTargets = {
  final: { product: ['price'], variant: ['price'] },
  regular: { product: [], variant: [] },
}) {
  const productPriceInfo = getPriceInfo(product, isIndex, indexPriceTargets, false);
  const productCandidate = getCandidatePrice(rule, undefined, now, productPriceInfo);
  if (productCandidate && productCandidate.amount < productPriceInfo.finalAmount) {
    productPriceInfo.setFinal(productCandidate.raw);
  }

  for (const variant of getVariantList(product)) {
    const variantPriceInfo = getPriceInfo(variant, isIndex, indexPriceTargets, true);
    const candidate = getCandidatePrice(rule, rule.variants?.[variant.sku], now, variantPriceInfo);
    if (candidate && candidate.amount < variantPriceInfo.finalAmount) {
      variantPriceInfo.setFinal(candidate.raw);
    }
  }
}

/**
 * Apply catalog price rules to state.content.data (single product request).
 * Finds the lowest active promotion price for the product path and applies it only
 * if it is less than the product's current price. Also records the most recently
 * started active rule's start time as a last-modified source.
 * @param {PipelineState} state
 * @param {PipelineResponse} [res]
 */
export function applyProductPriceRule(state, res) {
  const { catalogPriceRules, content, info } = state;
  if (!catalogPriceRules?.promotions?.length || !content?.data) return;

  const productPath = info.path.replace(/\.(json|html)$/, '');
  const now = Date.now();

  if (res) {
    let newestStartMs = 0;
    for (const promotion of catalogPriceRules.promotions) {
      for (const r of promotion.rules) {
        if (r.path !== productPath || !isActive(r, now)) continue;
        applyRuleToProduct(content.data, r, now, false);
        if (r.start) {
          const ms = new Date(r.start).getTime();
          if (ms > newestStartMs) newestStartMs = ms;
        }
      }
    }
    if (newestStartMs) {
      recordLastModified(state, res, 'price-rules', new Date(newestStartMs).toUTCString());
    }
    return;
  }

  for (const promotion of catalogPriceRules.promotions) {
    for (const r of promotion.rules) {
      if (r.path !== productPath || !isActive(r, now)) continue;
      applyRuleToProduct(content.data, r, now, false);
    }
  }
}

/**
 * Apply catalog price rules to the stored index (index request).
 * The stored index is keyed by product path (`{ [path]: { data } }`); entry data carries no
 * `path` field, so the key is what gets matched against rule paths.
 * For each product, finds the lowest active promotion price and applies it only
 * if it is less than the product's current price. Also records the most recently
 * started active rule's start time (across all paths in the index) as a last-modified source.
 * @param {PipelineState} state
 * @param {PipelineResponse} [res]
 */
export function applyCatalogPriceRules(state, res) {
  const { catalogPriceRules, content } = state;
  if (!catalogPriceRules?.promotions?.length || !content?.data) return;

  const now = Date.now();
  const indexPriceTargets = getIndexPriceTargets(state);

  let newestStartMs = 0;
  for (const promotion of catalogPriceRules.promotions) {
    for (const rule of promotion.rules) {
      if (!isActive(rule, now)) continue;
      const entry = content.data[rule.path]?.data;
      if (entry) {
        applyRuleToProduct(entry, rule, now, true, indexPriceTargets);
        if (rule.start) {
          const startMs = new Date(rule.start).getTime();
          if (startMs > newestStartMs) {
            newestStartMs = startMs;
          }
        }
      }
    }
  }

  if (newestStartMs && res) {
    recordLastModified(state, res, 'price-rules', new Date(newestStartMs).toUTCString());
  }
}

/**
 * Parse a merchant-feed price string (e.g. "179.95 CAD") into amount + currency.
 * @param {unknown} price
 * @returns {{ amount: number, currency: string, raw: string } | null}
 */
function parseFeedPrice(price) {
  if (typeof price !== 'string') return null;
  const match = price.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
  if (!match) return null;
  return { amount: parseFloat(match[1]), currency: match[2].trim(), raw: match[1] };
}

/**
 * Google merchant `sale_price_effective_date` is an ISO 8601 interval `start/end`.
 * Only emitted when the rule carries both bounds.
 * @param {{ start?: string, end?: string }} rule
 * @returns {string | null}
 */
function feedEffectiveDate(rule) {
  return rule.start && rule.end ? `${rule.start}/${rule.end}` : null;
}

/**
 * @param {{ price?: string, sale_price?: string }} entry
 * @returns {{
 *   finalAmount: number,
 *   regularAmount: number,
 *   regularRaw: string | undefined,
 *   currency: string,
 * }}
 */
function getFeedPriceInfo(entry) {
  const regular = parseFeedPrice(entry.price);
  const currentSale = parseFeedPrice(entry.sale_price);
  const current = currentSale && regular && currentSale.amount < regular.amount
    ? currentSale
    : regular ?? currentSale;
  return {
    finalAmount: current?.amount ?? NaN,
    regularAmount: regular?.amount ?? NaN,
    regularRaw: regular?.raw,
    currency: regular?.currency ?? current?.currency ?? '',
  };
}

/**
 * Apply a catalog price rule to a single merchant-feed entry, writing the discounted
 * value to `sale_price` (leaving `price` as the regular price) and, when the rule has a
 * window, `sale_price_effective_date`. Variants (object keyed by SKU) get variant-specific
 * pricing when present, otherwise inherit the parent rule's price.
 * @param {object} data - the feed entry data (has `price`, optional `variants`)
 * @param {SharedTypes.CatalogPriceRule} rule
 * @param {number} now
 */
function applyRuleToFeedEntry(data, rule, now) {
  const parentInfo = getFeedPriceInfo(data);
  const parentCandidate = getCandidatePrice(rule, undefined, now, parentInfo);
  if (parentCandidate && parentCandidate.amount < parentInfo.finalAmount) {
    data.sale_price = parentInfo.currency ? `${parentCandidate.raw} ${parentInfo.currency}` : parentCandidate.raw;
    const effective = feedEffectiveDate(rule);
    if (effective) {
      data.sale_price_effective_date = effective;
    } else {
      delete data.sale_price_effective_date;
    }
  }

  if (data.variants) {
    for (const variant of Object.values(data.variants)) {
      const variantInfo = getFeedPriceInfo(variant);
      const variantRule = rule.variants?.[variant.sku];
      const candidate = getCandidatePrice(rule, variantRule, now, variantInfo);
      if (!candidate || !(candidate.amount < variantInfo.finalAmount)) {
        continue;
      }
      variant.sale_price = variantInfo.currency
        ? `${candidate.raw} ${variantInfo.currency}`
        : candidate.raw;
      const effective = variantRule && isActive(variantRule, now)
        ? feedEffectiveDate(variantRule) ?? feedEffectiveDate(rule)
        : feedEffectiveDate(rule);
      if (effective) {
        variant.sale_price_effective_date = effective;
      } else {
        delete variant.sale_price_effective_date;
      }
    }
  }
}

/**
 * Apply catalog price rules to a stored merchant feed (keyed by product path at the top
 * level, each entry `{ data }`). Discounts are reduced per SKU across all active
 * promotions and written to `sale_price`/`sale_price_effective_date` so `g:price`
 * stays the regular price. Also records the newest active rule start as a
 * last-modified source.
 * @param {PipelineState} state
 * @param {PipelineResponse} [res]
 */
export function applyMerchantFeedPriceRules(state, res) {
  const { catalogPriceRules, content } = state;
  if (!catalogPriceRules?.promotions?.length || !content?.data) return;

  const now = Date.now();
  let newestStartMs = 0;

  for (const promotion of catalogPriceRules.promotions) {
    for (const rule of promotion.rules) {
      if (!isActive(rule, now)) continue;
      const entry = content.data[rule.path]?.data;
      if (entry) {
        applyRuleToFeedEntry(entry, rule, now);
      }
      if (rule.start) {
        const ms = new Date(rule.start).getTime();
        if (ms > newestStartMs) newestStartMs = ms;
      }
    }
  }

  if (newestStartMs && res) {
    recordLastModified(state, res, 'price-rules', new Date(newestStartMs).toUTCString());
  }
}
