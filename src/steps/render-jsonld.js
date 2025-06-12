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

/* eslint-disable max-len */
import { select } from 'hast-util-select';
import { h } from 'hastscript';
import { constructImageUrl } from './create-pictures.js';

function sanitizeJsonLd(jsonLd) {
  const sanitizedJsonLd = jsonLd.replaceAll('<', '&#x3c;').replaceAll('>', '&#x3e;');
  return JSON.stringify(JSON.parse(sanitizedJsonLd.trim()), null, 2);
}

function renderOffer(state, variant, simple = false) {
  const offer = { '@type': 'Offer' };

  if (variant.sku) offer.sku = variant.sku;
  if (variant.name) offer.name = variant.name;

  if (variant.images && variant.images.length) {
    const variantImages = [];
    for (const img of variant.images) {
      if (img.url) variantImages.push(constructImageUrl(state, img.url));
    }
    if (variantImages.length) offer.image = variantImages;
  }

  const { price } = variant;
  if (price) {
    if (price.currency) offer.priceCurrency = price.currency;
    if (price.final) offer.price = price.final;
  }

  if (variant.availability) offer.availability = `https://schema.org/${variant.availability}`;
  if (variant.itemCondition) offer.itemCondition = `https://schema.org/${variant.itemCondition}`;
  if (variant.url) offer.url = variant.url;

  if (variant.options) offer.options = variant.options;
  if (variant.custom && !simple) offer.custom = variant.custom;

  return offer;
}

function convertToJsonLD(state, product) {
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
  };

  if (product.sku) jsonld.sku = product.sku;

  const name = product.metaTitle || product.name;
  if (name) jsonld.name = name;

  const description = product.metaDescription || product.description;
  if (description) jsonld.description = description;

  if (product.url) jsonld.url = product.url;

  if (product.brand) {
    jsonld.brand = { '@type': 'Brand', name: product.brand };
  }

  if (product.images && product.images.length) {
    const images = [];
    for (const img of product.images) {
      if (img.url) images.push(constructImageUrl(state, img.url));
    }
    if (images.length) jsonld.image = images;
  }

  if (product.variants && product.variants.length) {
    const offers = [];
    for (const variant of product.variants) {
      const offer = renderOffer(state, variant);
      offers.push(offer);
    }
    if (offers.length) jsonld.offers = offers;
  } else {
    const offer = renderOffer(state, product, true);
    jsonld.offers = [offer];
  }

  if (product.custom && typeof product.custom === 'object') {
    jsonld.custom = { ...product.custom };
  }

  return JSON.stringify(jsonld, null, 2);
}

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function render(state, _, res) {
  const { content } = state;
  const { hast } = content;

  // create the jsonld and insert it into the head
  const jsonld = convertToJsonLD(state, content.data);
  const head = select('head', hast);
  head.children.push(h('script', { type: 'application/ld+json' }, sanitizeJsonLd(jsonld)));

  res.document = hast;
}
