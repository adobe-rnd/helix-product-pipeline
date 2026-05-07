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
  if (!isActive(rule, now)) return;

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
 * Apply state.priceRule to state.content.data (single product request).
 * @param {PipelineState} state
 */
export function applyProductPriceRule(state) {
  const { priceRule, content } = state;
  if (!priceRule || !content?.data) return;
  applyRuleToProduct(content.data, priceRule, Date.now(), false);
}

/**
 * Apply state.catalogPriceRules to the stored index (index request).
 * Index product entries are flat — price is a root field, not price.final.
 * @param {PipelineState} state
 */
export function applyCatalogPriceRules(state) {
  const { catalogPriceRules, content } = state;
  if (!catalogPriceRules || !content?.data) return;

  const now = Date.now();
  for (const entry of Object.values(content.data)) {
    const product = entry?.data;
    // eslint-disable-next-line no-continue
    if (!product?.path) continue;
    const rule = catalogPriceRules[product.path];
    if (rule) applyRuleToProduct(product, rule, now, true);
  }
}
