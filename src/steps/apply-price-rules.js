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

/**
 * @param {{ start?: string, end?: string }} rule
 * @param {number} now
 * @returns {boolean}
 */
function isActive(rule, now) {
  if (rule.start && new Date(rule.start).getTime() > now) return false;
  if (rule.end && new Date(rule.end).getTime() < now) return false;
  return true;
}

/**
 * Apply a catalog price rule to a product object.
 * In product mode, mutates price.final. In index mode, mutates the flat price field.
 * Variant rules are only applied in product mode (index entries are flat).
 * @param {object} product
 * @param {SharedTypes.CatalogPriceRule} rule
 * @param {number} now
 * @param {boolean} isIndex
 */
function applyRuleToProduct(product, rule, now, isIndex = false) {
  if (rule.price != null) {
    if (isIndex) {
      product.price = rule.price;
    } else if (product.price) {
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
    const variantRule = rule.variants?.[variant.sku];
    if (variantRule && isActive(variantRule, now)) {
      if (variantRule.price != null) {
        if (isIndex) {
          variant.price = variantRule.price;
        } else if (variant.price) {
          variant.price.final = variantRule.price;
        }
      }
    } else if (rule.price != null) {
      // inherit parent product price
      if (isIndex) {
        variant.price = rule.price;
      } else if (variant.price) {
        variant.price.final = rule.price;
      }
    }
  }
}

/**
 * Find the lowest-priced active promotion rule for a product path across all promotions.
 * Returns null if no active rule matches or if the best price is not lower than the product price.
 * @param {SharedTypes.CatalogPriceRules} catalogPriceRules
 * @param {string} productPath
 * @param {number} now
 * @param {number} currentPrice - product's current price as a number for comparison
 * @returns {SharedTypes.CatalogPriceRule | null}
 */
function findBestRule(catalogPriceRules, productPath, now, currentPrice) {
  let bestRule = null;
  let bestPrice = currentPrice;

  for (const promotion of catalogPriceRules.promotions) {
    for (const rule of promotion.rules) {
      if (rule.path !== productPath) continue;
      if (!isActive(rule, now)) continue;
      const p = parseFloat(rule.price);
      if (!Number.isNaN(p) && p < bestPrice) {
        bestPrice = p;
        bestRule = rule;
      }
    }
  }

  return bestRule;
}

/**
 * Apply catalog price rules to state.content.data (single product request).
 * Finds the lowest active promotion price for the product path and applies it only
 * if it is less than the product's current price.
 * @param {PipelineState} state
 */
export function applyProductPriceRule(state) {
  const { catalogPriceRules, content, info } = state;
  if (!catalogPriceRules?.promotions?.length || !content?.data) return;

  const productPath = info.path.replace(/\.(json|html)$/, '');
  const now = Date.now();
  const currentPrice = parseFloat(content.data.price?.final ?? 'Infinity');
  const rule = findBestRule(catalogPriceRules, productPath, now, currentPrice);
  if (rule) applyRuleToProduct(content.data, rule, now, false);
}

/**
 * Apply catalog price rules to the stored index (index request).
 * For each product, finds the lowest active promotion price and applies it only
 * if it is less than the product's current price.
 * @param {PipelineState} state
 */
export function applyCatalogPriceRules(state) {
  const { catalogPriceRules, content } = state;
  if (!catalogPriceRules?.promotions?.length || !content?.data) return;

  const now = Date.now();

  // Build a path → best rule map across all promotions
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

  for (const entry of Object.values(content.data)) {
    const product = entry?.data;
    // eslint-disable-next-line no-continue
    if (!product?.path) continue;
    const rule = bestRuleByPath.get(product.path);
    if (!rule) continue;
    const rulePrice = parseFloat(rule.price);
    const productPrice = parseFloat(product.price);
    if (!Number.isNaN(productPrice) && rulePrice < productPrice) {
      applyRuleToProduct(product, rule, now, true);
    }
  }
}
