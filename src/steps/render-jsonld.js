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

const WEIGHT_UNIT_CODES = {
  kg: 'KGM', g: 'GRM', lb: 'LBR', oz: 'ONZ',
};
const DIMENSIONS_UNIT_CODES = {
  cm: 'CMT', mm: 'MMT', in: 'INH',
};

function quantitativeWeight(weight) {
  if (!weight || typeof weight.value !== 'number' || !weight.unit) return null;
  const unitCode = WEIGHT_UNIT_CODES[weight.unit];
  if (!unitCode) return null;
  return {
    '@type': 'QuantitativeValue',
    value: weight.value,
    unitCode,
    unitText: weight.unit,
  };
}

function quantitativeDimension(value, unitCode) {
  return {
    '@type': 'QuantitativeValue',
    value,
    unitCode,
  };
}

function renderShippingDetails(shippingDimensions) {
  if (!shippingDimensions || typeof shippingDimensions !== 'object') return null;
  const {
    weight, height, width, depth, dimensionsUnit,
  } = shippingDimensions;

  const details = { '@type': 'OfferShippingDetails' };
  const weightQv = quantitativeWeight(weight);
  if (weightQv) details.weight = weightQv;

  const dimUnitCode = dimensionsUnit ? DIMENSIONS_UNIT_CODES[dimensionsUnit] : null;
  if (dimUnitCode) {
    if (typeof height === 'number') details.height = quantitativeDimension(height, dimUnitCode);
    if (typeof width === 'number') details.width = quantitativeDimension(width, dimUnitCode);
    if (typeof depth === 'number') details.depth = quantitativeDimension(depth, dimUnitCode);
  }

  // Only emit shippingDetails if it carries at least one measurement
  if (!details.weight && !details.height && !details.width && !details.depth) return null;
  return details;
}

function renderOffer(state, variant, simple = false, fallbackShippingDimensions = null) {
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
    jsonldExtensions,
    shippingDimensions,
  } = variant;

  const shippingDetails = renderShippingDetails(shippingDimensions ?? fallbackShippingDimensions);

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

  const offer = {
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
    ...(shippingDetails && { shippingDetails }),
    ...(!simple && custom && { custom }),
  };

  if (!simple && jsonldExtensions && typeof jsonldExtensions === 'object') {
    Object.assign(offer, jsonldExtensions);
  }

  return offer;
}

/**
 * Build a schema.org AggregateRating node from Product Bus rating data.
 * Values are stored as numeric strings and coerced to numbers here. Returns
 * null (so the field is omitted) when there is no rating value or no positive
 * count, since an empty aggregate is invalid for Google rich results.
 * @param {any} rating
 * @returns {object|null}
 */
function renderAggregateRating(rating) {
  if (!rating || typeof rating !== 'object') return null;

  const ratingValue = rating.ratingValue != null && rating.ratingValue !== ''
    ? Number(rating.ratingValue)
    : null;
  if (ratingValue == null || Number.isNaN(ratingValue)) return null;

  const toCount = (v) => {
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const ratingCount = toCount(rating.ratingCount);
  const reviewCount = toCount(rating.reviewCount);
  // Google requires at least one of ratingCount / reviewCount, with a positive value.
  if (ratingCount == null && reviewCount == null) return null;

  const toNum = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  return {
    '@type': 'AggregateRating',
    ratingValue,
    ...(ratingCount != null && { ratingCount }),
    ...(reviewCount != null && { reviewCount }),
    bestRating: toNum(rating.bestRating) ?? 5,
    worstRating: toNum(rating.worstRating) ?? 1,
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
    jsonldExtensions,
    weight,
    shippingDimensions,
    aggregateRating,
  } = product;

  const weightQv = quantitativeWeight(weight);

  /** @type {any} */
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...(url && { '@id': url }),
    ...(sku && { sku }),
    ...(name || metaTitle ? { name: name || metaTitle } : {}),
    ...(metaDescription || description ? { description: metaDescription || stripHTML(description).trim() } : {}),
    ...(gtin && { gtin }),
    ...(url && { url }),
    ...(brand && { brand: { '@type': 'Brand', name: brand } }),
    ...(weightQv && { weight: weightQv }),
  };

  const resolvedImages = images
    .map((img) => img.url && constructImageUrl(state, img.url))
    .filter(Boolean);
  if (resolvedImages.length) jsonld.image = resolvedImages;

  const resolvedOffers = variants.length
    ? variants.map((v) => renderOffer(state, v, false, shippingDimensions))
    : [renderOffer(state, product, true)];
  jsonld.offers = resolvedOffers;

  const aggregateRatingLd = renderAggregateRating(aggregateRating);
  if (aggregateRatingLd) jsonld.aggregateRating = aggregateRatingLd;

  if (custom && typeof custom === 'object') {
    jsonld.custom = { ...custom };
  }

  if (jsonldExtensions && typeof jsonldExtensions === 'object') {
    Object.assign(jsonld, jsonldExtensions);
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
