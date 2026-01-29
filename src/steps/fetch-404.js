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
import { PipelineStatusError } from '@adobe/helix-html-pipeline';
import { extractLastModified, recordLastModified } from '../utils/last-modified.js';
import { setProduct404CacheHeaders } from './set-cache-headers.js';

/**
 * Loads the 404.html from code-bus and stores it in `res.body`
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetch404(state, req, res) {
  const {
    org, site, ref,
  } = state;

  /** @type {Record<string, string>} */
  const headers = {};
  const authorization = req.headers.get('authorization');
  if (authorization) {
    headers.authorization = authorization;
  }
  const ret = await fetch(`https://${ref}--${site}--${org}.aem.live/404.html`, { headers });
  if (ret.status === 401) {
    throw new PipelineStatusError(401, 'unauthorized');
  }
  if (ret.status === 200) {
    // override last-modified if source-last-modified is set
    const lastModified = extractLastModified(ret.headers);
    if (lastModified) {
      recordLastModified(state, res, 'content', lastModified);
    }

    // keep 404 response status
    res.body = await ret.text();
    res.headers.set('last-modified', ret.headers.get('last-modified'));
    res.headers.set('content-type', 'text/html; charset=utf-8');
  }

  await setProduct404CacheHeaders(state, req, res);
}
