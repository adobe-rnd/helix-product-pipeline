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
 * @returns {string}
 */
function catalogRulesKey(org, site) {
  return `${org}/${site}/prices/catalog/rules.json`;
}

/** @returns {SharedTypes.CatalogPriceRules} */
function emptyRules() {
  return { promotions: [] };
}

/**
 * Fetch all catalog price rules. Sets state.catalogPriceRules.
 * Used for both single-product and index routes.
 * @param {PipelineState} state
 */
export async function fetchCatalogPriceRules(state) {
  const { org, site, s3Loader } = state;

  /** @type {PipelineResponse} */
  let res;
  try {
    res = await s3Loader.getObject(PRICING_BUCKET_ID, catalogRulesKey(org, site));
    if (res.status !== 200) {
      state.catalogPriceRules = emptyRules();
      return;
    }

    /** @type {SharedTypes.CatalogPriceRules} */
    const rules = JSON.parse(res.body);
    if (!rules || !Array.isArray(rules.promotions)) {
      state.catalogPriceRules = emptyRules();
      return;
    }

    const now = Date.now();

    // Pre-filter rules whose end is already past; remove promotions with no remaining rules
    state.catalogPriceRules = {
      promotions: rules.promotions
        .map((promotion) => ({
          ...promotion,
          rules: promotion.rules.filter((rule) => !rule.end || new Date(rule.end).getTime() > now),
        }))
        .filter((promotion) => promotion.rules.length > 0),
    };
  } catch (e) {
    state.log.warn(`failed to fetch catalog price rules: ${res?.status ?? 'unknown error'}`, e);
    state.catalogPriceRules = emptyRules();
  }
}
