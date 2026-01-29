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
import { stripHTML } from './utils.js';

function renderOffer(state, variant, simple = false) {
  const {
    sku,
    name,
    images,
    price,
    availability,
    itemCondition,
    url,
    options,
    custom,
    gtin,
  } = variant;

  const resolvedImages = Array.isArray(images)
    ? images.map((img) => img.url && constructImageUrl(state, img.url)).filter(Boolean)
    : [];

  // Create priceSpecification object if price data is available
  const regularPrice = price?.regular ? parseFloat(price.regular) : null;
  const finalPrice = price?.final ? parseFloat(price.final) : null;

  // Create priceSpecification object if price data is available
  const priceSpecification = price?.currency
    && regularPrice && finalPrice
    && finalPrice < regularPrice ? {
      '@type': 'UnitPriceSpecification',
      priceType: 'https://schema.org/ListPrice',
      price: regularPrice,
      priceCurrency: price.currency,
    } : null;

  return {
    '@type': 'Offer',
    ...(sku && { sku }),
    ...(name && { name }),
    ...(resolvedImages.length && { image: resolvedImages }),
    ...(price?.currency && { priceCurrency: price.currency }),
    ...(price?.final && { price: price.final }),
    ...(availability && { availability: `https://schema.org/${availability}` }),
    ...(itemCondition && { itemCondition: `https://schema.org/${itemCondition}` }),
    ...(gtin && { gtin }),
    ...(url && { url }),
    ...(options && { options }),
    ...(priceSpecification && { priceSpecification }),
    ...(!simple && custom && { custom }),
  };
}

export function convertToJsonLD(state, product) {
  // If the product has a jsonld property, use it directly instead of generating
  if (product.jsonld) {
    return typeof product.jsonld === 'string'
      ? product.jsonld
      : JSON.stringify(product.jsonld, null, 2);
  }

  const {
    sku,
    metaTitle,
    name,
    metaDescription,
    description,
    url,
    brand,
    images = [],
    variants = [],
    custom,
    gtin,
  } = product;

  /** @type {any} */
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...(sku && { sku }),
    ...(name || metaTitle ? { name: name || metaTitle } : {}),
    ...(metaDescription || description ? { description: metaDescription || stripHTML(description).trim() } : {}),
    ...(gtin && { gtin }),
    ...(url && { url }),
    ...(brand && { brand: { '@type': 'Brand', name: brand } }),
  };

  const resolvedImages = images
    .map((img) => img.url && constructImageUrl(state, img.url))
    .filter(Boolean);
  if (resolvedImages.length) jsonld.image = resolvedImages;

  const resolvedOffers = variants.length
    ? variants.map((v) => renderOffer(state, v))
    : [renderOffer(state, product, true)];
  jsonld.offers = resolvedOffers;

  if (custom && typeof custom === 'object') {
    jsonld.custom = { ...custom };
  }

  return JSON.stringify(jsonld, null, 2);
}

/**
 * @param {PipelineState} state
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function render(state, res) {
  const { content } = state;
  const { hast } = content;

  // create the jsonld and insert it into the head
  const jsonld = convertToJsonLD(state, content.data);
  const head = select('head', hast);
  head.children.push(h('script', { type: 'application/ld+json' }, jsonld));

  res.document = hast;
}
