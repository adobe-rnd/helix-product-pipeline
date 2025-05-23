/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { extractLastModified, recordLastModified } from '../utils/last-modified.js';
import { slugger } from './utils.js';

/**
 * Loads the content from either the content-bus or code-bus and stores it in `state.content`
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchContent(state, req, res) {
  const {
    info, owner, repo, config,
  } = state;
  const bucketId = 'adobe-commerce-catalog';
  const { route } = config;
  const { storeCode, storeViewCode } = route;

  let sku;

  // if route params only contains the urlKey than we
  // need to head first to get the sku

  // conditioanlly strip .json off urlKey
  const urlKey = route.params.urlKey?.replace('.json', '');
  if (Object.keys(route.params).length === 1 && urlKey) {
    const headKey = `${owner}/${repo}/${storeCode}/${storeViewCode}/urlkeys/${urlKey}`;

    const headRes = await state.s3Loader.headObject(bucketId, headKey);

    if (headRes.status === 200) {
      sku = headRes.headers.get('sku');
    } else {
      res.status = 404;
      res.error = `HEAD: failed to load ${info.resourcePath} from product-bus: ${headRes.status}`;
    }
  } else {
    sku = route.params.sku.replace('.json', '');
  }

  const slug = slugger(sku);
  const key = `${owner}/${repo}/${storeCode}/${storeViewCode}/products/${slug}.json`;

  const ret = await state.s3Loader.getObject(bucketId, key);

  if (ret.status === 200) {
    res.status = 200;
    delete res.error;
    state.content.data = JSON.parse(ret.body);

    recordLastModified(state, res, 'content', extractLastModified(ret.headers));
  } else {
    // keep 404, but propagate others as 502
    res.status = ret.status === 404 ? 404 : 502;
    res.error = `failed to load ${info.resourcePath} from ${state.content.sourceBus}-bus: ${ret.status}`;
  }
}
