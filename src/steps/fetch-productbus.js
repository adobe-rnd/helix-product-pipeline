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

/**
 * Loads the content from product-bus and stores it in `state.content.data`
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchContent(state, req, res) {
  const { info, owner, site } = state;
  const bucketId = 'helix-product-bus';

  // Remove extension from path (.json or .xml)
  const path = info.path.replace(/\.json$/, '').replace(/\.xml$/, '');
  const key = `${owner}/${site}/catalog${path}.json`;

  const ret = await state.s3Loader.getObject(bucketId, key);

  if (ret.status === 200) {
    try {
      res.status = 200;
      delete res.error;
      state.content.data = JSON.parse(ret.body);

      recordLastModified(state, res, 'content', extractLastModified(ret.headers));
    } catch (e) {
      res.status = 400;
      res.error = `failed to parse ${key} from product-bus: ${e.message}`;
    }
  } else {
    res.status = ret.status === 404 ? 404 : 502;
    res.error = `failed to load ${key} from product-bus: ${ret.status}`;
  }
}
