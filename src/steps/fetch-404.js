/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { computeContentPathKey, computeCodePathKey, setCachingHeaders } from './set-cache-headers.js';

/**
 * Loads the 404.html from code-bus and stores it in `res.body`
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetch404(state, req, res) {
  const {
    owner, repo, ref, contentBusId, partition,
  } = state;
  const ret = await fetch(`https://${ref}--${repo}--${owner}.aem.live/404.html`);
  if (ret.status === 200) {
    // override last-modified if source-last-modified is set
    const lastModified = extractLastModified(ret.headers);
    if (lastModified) {
      recordLastModified(state, res, 'content', lastModified);
    }

    // keep 404 response status
    res.body = ret.body;
    res.headers.set('last-modified', ret.headers.get('last-modified'));
    res.headers.set('content-type', 'text/html; charset=utf-8');
  }

  // set 404 keys in any case
  // always provide code and content keys since a resource could be added later to either bus
  const keys = [];
  // content keys
  // provide either (prefixed) preview or (unprefixed) live content keys
  const contentKeyPrefix = partition === 'preview' ? 'p_' : '';
  keys.push(`${contentKeyPrefix}${await computeContentPathKey(state)}`);
  keys.push(`${contentKeyPrefix}${contentBusId}`);

  // code keys
  keys.push(await computeCodePathKey(state));
  keys.push(`${ref}--${repo}--${owner}_404`);
  keys.push(`${ref}--${repo}--${owner}_code`);

  setCachingHeaders(state, req, res, keys);
}
