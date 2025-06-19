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
  } = variant;

  const resolvedImages = Array.isArray(images)
    ? images.map((img) => img.url && constructImageUrl(state, img.url)).filter(Boolean)
    : [];

  return {
    '@type': 'Offer',
    ...(sku && { sku }),
    ...(name && { name }),
    ...(resolvedImages.length && { image: resolvedImages }),
    ...(price?.currency && { priceCurrency: price.currency }),
    ...(price?.final && { price: price.final }),
    ...(availability && { availability: `https://schema.org/${availability}` }),
    ...(itemCondition && { itemCondition: `https://schema.org/${itemCondition}` }),
    ...(url && { url }),
    ...(options && { options }),
    ...(!simple && custom && { custom }),
  };
}

function convertToJsonLD(state, product) {
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
  } = product;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...(sku && { sku }),
    ...(metaTitle || name ? { name: metaTitle || name } : {}),
    ...(metaDescription || description ? { description: metaDescription || description } : {}),
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
  head.children.push(h('script', { type: 'application/ld+json' }, jsonld));

  res.document = hast;
}
