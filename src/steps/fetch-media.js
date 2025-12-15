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
 * Loads the content from either the content-bus or code-bus and stores it in `state.content`
 * @param {PipelineState} state
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchMedia(state, res) {
  const {
    info, owner, site,
  } = state;
  const bucketId = 'helix-product-bus';

  const key = `${owner}/${site}/media/${info.originalFilename}`;
  const ret = await state.s3Loader.getObject(bucketId, key);

  if (ret.status === 200) {
    res.status = 200;
    delete res.error;
    state.content.data = ret.body;
    state.content.headers = ret.headers;

    recordLastModified(state, res, 'content', extractLastModified(ret.headers));
  } else {
    // keep 404, but propagate others as 502
    res.status = ret.status === 404 ? 404 : 502;
    res.error = `failed to load ${info.resourcePath} from product-bus: ${ret.status}`;
  }
}
