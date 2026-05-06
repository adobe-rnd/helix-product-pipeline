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

const PRICING_BUCKET_ID = 'helix-commerce-pricing';

/**
 * @param {string} org
 * @param {string} site
 * @param {string} path - product path without extension, e.g. "/us/en/my-product"
 * @returns {string}
 */
function byPathKey(org, site, path) {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${org}/${site}/prices/catalog/_byPath/${clean}.json`;
}

/**
 * @param {string} org
 * @param {string} site
 * @returns {string}
 */
function catalogRulesKey(org, site) {
  return `${org}/${site}/prices/catalog/rules.json`;
}

/**
 * Fetch the price rule for a single product path. Sets state.priceRule.
 * No-ops if PRICING_BUCKET is not available in the s3Loader.
 * @param {PipelineState} state
 */
export async function fetchProductPriceRule(state) {
  const {
    org,
    site,
    info,
    s3Loader,
  } = state;
  const path = info.path.replace(/\.(json|html)$/, '');

  try {
    const res = await s3Loader.getObject(PRICING_BUCKET_ID, byPathKey(org, site, path));
    if (res.status !== 200) {
      state.priceRule = null;
      return;
    }
    state.priceRule = JSON.parse(res.body);
  } catch {
    state.priceRule = null;
  }
}

/**
 * Fetch all catalog price rules. Sets state.catalogPriceRules.
 * No-ops if PRICING_BUCKET is not available in the s3Loader.
 * @param {PipelineState} state
 */
export async function fetchCatalogPriceRules(state) {
  const { org, site, s3Loader } = state;

  try {
    const res = await s3Loader.getObject(PRICING_BUCKET_ID, catalogRulesKey(org, site));
    if (res.status !== 200) {
      state.catalogPriceRules = {};
      return;
    }

    /** @type {SharedTypes.CatalogPriceRules} */
    const rules = JSON.parse(res.body);
    const now = Date.now();

    // Pre-filter fully expired product-level rules to avoid per-product checks in apply step
    state.catalogPriceRules = Object.fromEntries(
      Object.entries(rules).filter(([, rule]) => !rule.end || new Date(rule.end).getTime() > now),
    );
  } catch {
    state.catalogPriceRules = {};
  }
}
