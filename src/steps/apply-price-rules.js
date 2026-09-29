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
 * Resolve the index columns that carry the final price for products and variants.
 * Mirrors the indexer config model: variants use `properties.variants ?? properties`.
 * When no explicit `price.final` mapping exists, fall back to the legacy `price`
 * column so existing indices keep working.
 *
 * @param {PipelineState} state
 * @returns {{ product: string[], variant: string[] }}
 */
function getIndexPriceTargets(state) {
  const properties = state.config?.public?.productIndexerConfig?.properties;
  const variantProperties = properties?.variants ?? properties;
  const product = getMappedFields(properties, 'price.final');
  const variant = getMappedFields(variantProperties, 'price.final');
  return {
    product: product.length ? product : getLegacyIndexPriceFallback(properties),
    variant: variant.length ? variant : getLegacyIndexPriceFallback(variantProperties),
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
 * Apply a catalog price rule to a product object.
 * In product mode, mutates price.final. In index mode, mutates the column(s)
 * mapped from `price.final` (falling back to the legacy flat `price` field).
 * In non-index mode, the product price is only written if the rule price is lower
 * (a rule may be selected purely for variant benefit without improving the product price).
 * @param {object} product
 * @param {SharedTypes.CatalogPriceRule} rule
 * @param {number} now
 * @param {boolean} isIndex
 * @param {{ product: string[], variant: string[] }} [indexPriceTargets]
 */
function applyRuleToProduct(product, rule, now, isIndex = false, indexPriceTargets = { product: ['price'], variant: ['price'] }) {
  if (rule.price != null) {
    if (isIndex) {
      const currentProductPrice = getCurrentIndexPrice(product, indexPriceTargets.product);
      if (parseFloat(rule.price) < currentProductPrice) {
        setIndexPrice(product, indexPriceTargets.product, rule.price);
      }
    } else if (product.price && parseFloat(rule.price) < parseFloat(product.price.final)) {
      product.price.final = rule.price;
    }
  }

  // Variants may be an array (product JSON) or an object keyed by SKU (stored index)
  /** @type {SharedTypes.ProductBusVariant[]} */
  let variantList;
  if (Array.isArray(product.variants)) {
    variantList = product.variants;
  } else if (product.variants) {
    variantList = Object.values(product.variants);
  } else {
    variantList = [];
  }

  for (const variant of variantList) {
    const currentVariantPrice = isIndex
      ? getCurrentIndexPrice(variant, indexPriceTargets.variant)
      : parseFloat(variant.price?.final);
    const variantRule = rule.variants?.[variant.sku];
    if (variantRule && isActive(variantRule, now)) {
      if (variantRule.price != null
        && parseFloat(variantRule.price) < currentVariantPrice) {
        if (isIndex) {
          setIndexPrice(variant, indexPriceTargets.variant, variantRule.price);
        } else if (variant.price) {
          variant.price.final = variantRule.price;
        }
      }
    } else if (rule.price != null && parseFloat(rule.price) < currentVariantPrice) {
      // inherit parent product price only if lower than variant's current price
      if (isIndex) {
        setIndexPrice(variant, indexPriceTargets.variant, rule.price);
      } else if (variant.price) {
        variant.price.final = rule.price;
      }
    }
  }
}

/**
 * Find the best active promotion rule for a product across all promotions.
 * A rule qualifies if its price is lower than the product's current price OR if any of
 * its active variant-specific prices are lower than the corresponding variant's current price.
 * Among qualifying rules, the one with the lowest product-level price wins.
 * @param {SharedTypes.CatalogPriceRules} catalogPriceRules
 * @param {string} productPath
 * @param {number} now
 * @param {object} product - the product object (used to read current price and variant prices)
 * @returns {SharedTypes.CatalogPriceRule | null}
 */
function findBestRule(catalogPriceRules, productPath, now, product) {
  const currentPrice = parseFloat(product.price?.final ?? 'Infinity');

  const variantCurrentPrices = new Map();
  const variantList = Array.isArray(product.variants)
    ? product.variants
    : Object.values(product.variants ?? {});
  for (const v of variantList) {
    if (v.sku && v.price?.final != null) {
      variantCurrentPrices.set(v.sku, parseFloat(v.price.final));
    }
  }

  let bestRule = null;
  let bestRuleProductPrice = Infinity;

  for (const promotion of catalogPriceRules.promotions) {
    for (const rule of promotion.rules) {
      if (rule.path !== productPath) continue;
      if (!isActive(rule, now)) continue;

      const p = parseFloat(rule.price);
      const lowersProductPrice = !Number.isNaN(p) && p < currentPrice;
      const lowersVariantPrice = Object.entries(rule.variants ?? {}).some(([sku, vr]) => {
        if (!isActive(vr, now) || vr.price == null) return false;
        const currentVPrice = variantCurrentPrices.get(sku);
        return currentVPrice !== undefined && parseFloat(vr.price) < currentVPrice;
      });

      if (!lowersProductPrice && !lowersVariantPrice) continue;

      const ruleProductPrice = Number.isNaN(p) ? Infinity : p;
      if (!bestRule || ruleProductPrice < bestRuleProductPrice) {
        bestRuleProductPrice = ruleProductPrice;
        bestRule = rule;
      }
    }
  }

  return bestRule;
}

/**
 * Find the best active promotion rule for an index row using the resolved
 * final-price columns for the product and its variants.
 *
 * @param {SharedTypes.CatalogPriceRule[]} rules
 * @param {number} now
 * @param {object} product
 * @param {{ product: string[], variant: string[] }} indexPriceTargets
 * @returns {SharedTypes.CatalogPriceRule | null}
 */
function findBestIndexRule(rules, now, product, indexPriceTargets) {
  const currentPrice = getCurrentIndexPrice(product, indexPriceTargets.product);

  const variantCurrentPrices = new Map();
  const variantList = Array.isArray(product.variants)
    ? product.variants
    : Object.values(product.variants ?? {});
  for (const variant of variantList) {
    if (!variant?.sku) {
      continue;
    }
    const price = getCurrentIndexPrice(variant, indexPriceTargets.variant);
    if (!Number.isNaN(price)) {
      variantCurrentPrices.set(variant.sku, price);
    }
  }

  let bestRule = null;
  let bestRuleProductPrice = Infinity;

  for (const rule of rules) {
    const p = parseFloat(rule.price);
    const lowersProductPrice = !Number.isNaN(p) && p < currentPrice;
    const lowersVariantPrice = Array.from(variantCurrentPrices.entries())
      .some(([sku, currentVPrice]) => {
        const variantRule = rule.variants?.[sku];
        if (variantRule && isActive(variantRule, now) && variantRule.price != null) {
          return parseFloat(variantRule.price) < currentVPrice;
        }
        return !Number.isNaN(p) && p < currentVPrice;
      });

    if (!lowersProductPrice && !lowersVariantPrice) continue;

    const ruleProductPrice = Number.isNaN(p) ? Infinity : p;
    if (!bestRule || ruleProductPrice < bestRuleProductPrice) {
      bestRuleProductPrice = ruleProductPrice;
      bestRule = rule;
    }
  }

  return bestRule;
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
  const rule = findBestRule(catalogPriceRules, productPath, now, content.data);
  if (rule) applyRuleToProduct(content.data, rule, now, false);

  if (res) {
    let newestStartMs = 0;
    for (const promotion of catalogPriceRules.promotions) {
      for (const r of promotion.rules) {
        if (r.path !== productPath || !isActive(r, now) || !r.start) continue;
        const ms = new Date(r.start).getTime();
        if (ms > newestStartMs) newestStartMs = ms;
      }
    }
    if (newestStartMs) {
      recordLastModified(state, res, 'price-rules', new Date(newestStartMs).toUTCString());
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

  // Build a path → active rules map and a path → newest start map across all promotions
  /** @type {Map<string, SharedTypes.CatalogPriceRule[]>} */
  const rulesByPath = new Map();
  /** @type {Map<string, number>} */
  const newestStartMsByPath = new Map();
  for (const promotion of catalogPriceRules.promotions) {
    for (const rule of promotion.rules) {
      if (!isActive(rule, now)) continue;
      const rules = rulesByPath.get(rule.path) ?? [];
      rules.push(rule);
      rulesByPath.set(rule.path, rules);
      if (rule.start) {
        const startMs = new Date(rule.start).getTime();
        if (startMs > (newestStartMsByPath.get(rule.path) ?? 0)) {
          newestStartMsByPath.set(rule.path, startMs);
        }
      }
    }
  }

  let newestStartMs = 0;
  for (const [path, entry] of Object.entries(content.data)) {
    const product = entry?.data;
    if (!product) continue;
    const rule = findBestIndexRule(rulesByPath.get(path) ?? [], now, product, indexPriceTargets);
    if (!rule) continue;
    applyRuleToProduct(product, rule, now, true, indexPriceTargets);
    const startMs = newestStartMsByPath.get(path) ?? 0;
    if (startMs > newestStartMs) newestStartMs = startMs;
  }

  if (newestStartMs && res) {
    recordLastModified(state, res, 'price-rules', new Date(newestStartMs).toUTCString());
  }
}

/**
 * Parse a merchant-feed price string (e.g. "179.95 CAD") into amount + currency.
 * @param {unknown} price
 * @returns {{ amount: number, currency: string } | null}
 */
function parseFeedPrice(price) {
  if (typeof price !== 'string') return null;
  const match = price.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
  if (!match) return null;
  return { amount: parseFloat(match[1]), currency: match[2].trim() };
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
 * Apply a catalog price rule to a single merchant-feed entry, writing the discounted
 * value to `sale_price` (leaving `price` as the regular price) and, when the rule has a
 * window, `sale_price_effective_date`. Variants (object keyed by SKU) get variant-specific
 * pricing when present, otherwise inherit the parent rule's price.
 * @param {object} data - the feed entry data (has `price`, optional `variants`)
 * @param {SharedTypes.CatalogPriceRule} rule
 * @param {number} now
 */
function applyRuleToFeedEntry(data, rule, now) {
  // rule comes from bestRuleByPath, which already filtered out non-numeric prices.
  const effective = feedEffectiveDate(rule);
  const ruleAmount = parseFloat(rule.price);
  const parent = parseFeedPrice(data.price);

  if (parent && ruleAmount < parent.amount) {
    data.sale_price = parent.currency ? `${rule.price} ${parent.currency}` : `${rule.price}`;
    if (effective) data.sale_price_effective_date = effective;
  }

  if (data.variants) {
    for (const variant of Object.values(data.variants)) {
      const vPrice = parseFeedPrice(variant.price);
      if (!vPrice) continue;
      const variantRule = rule.variants?.[variant.sku];
      let salePrice = null;
      let vEffective = effective;
      if (variantRule && isActive(variantRule, now) && variantRule.price != null
        && parseFloat(variantRule.price) < vPrice.amount) {
        salePrice = String(variantRule.price);
        vEffective = feedEffectiveDate(variantRule) ?? effective;
      } else if (ruleAmount < vPrice.amount) {
        salePrice = rule.price;
      }
      if (salePrice != null) {
        variant.sale_price = vPrice.currency ? `${salePrice} ${vPrice.currency}` : `${salePrice}`;
        if (vEffective) variant.sale_price_effective_date = vEffective;
      }
    }
  }
}

/**
 * Apply catalog price rules to a stored merchant feed (keyed by product path at the top
 * level, each entry `{ data }`). For each path, the lowest active rule wins; the discount
 * is written to `sale_price`/`sale_price_effective_date` so `g:price` stays the regular
 * price. Also records the newest active rule start as a last-modified source.
 * @param {PipelineState} state
 * @param {PipelineResponse} [res]
 */
export function applyMerchantFeedPriceRules(state, res) {
  const { catalogPriceRules, content } = state;
  if (!catalogPriceRules?.promotions?.length || !content?.data) return;

  const now = Date.now();

  /** @type {Map<string, SharedTypes.CatalogPriceRule>} */
  const bestRuleByPath = new Map();
  for (const promotion of catalogPriceRules.promotions) {
    for (const rule of promotion.rules) {
      if (!isActive(rule, now)) continue;
      const price = parseFloat(rule.price);
      if (Number.isNaN(price)) continue;
      const current = bestRuleByPath.get(rule.path);
      if (!current || price < parseFloat(current.price)) {
        bestRuleByPath.set(rule.path, rule);
      }
    }
  }

  let newestStartMs = 0;
  for (const [path, entry] of Object.entries(content.data)) {
    const data = entry?.data;
    if (!data) continue;
    const rule = bestRuleByPath.get(path);
    if (!rule) continue;
    applyRuleToFeedEntry(data, rule, now);
    if (rule.start) {
      const ms = new Date(rule.start).getTime();
      if (ms > newestStartMs) newestStartMs = ms;
    }
  }

  if (newestStartMs && res) {
    recordLastModified(state, res, 'price-rules', new Date(newestStartMs).toUTCString());
  }
}
