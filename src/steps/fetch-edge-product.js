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

import { PipelineStatusError } from '@adobe/helix-html-pipeline';
import { extractLastModified, recordLastModified } from '../utils/last-modified.js';

/**
 * Loads the content from either the content-bus and stores it in `state.content.edge`
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchEdgeContent(state, req, res) {
  const {
    info, org, site, ref, log,
  } = state;
  const { originalPath } = info;

  const contentUrl = `https://${ref}--${site}--${org}.aem.live${originalPath}`;
  try {
    /** @type {Record<string, string>} */
    const headers = {};
    const authorization = req.headers.get('authorization');
    if (authorization) {
      headers.authorization = authorization;
    }
    const contentRes = await fetch(contentUrl, { headers, redirect: 'manual' });
    if (contentRes.status === 401) {
      throw new PipelineStatusError(401, 'unauthorized');
    }

    // Handle redirects
    if (contentRes.status === 301) {
      const location = contentRes.headers.get('location');
      if (location) {
        state.redirect = { status: 301, location };
      }
      return;
    }

    if (contentRes.status === 200) {
      // Store the response without consuming the body yet.
      // The fallback path passes the body through directly;
      // the rendering path decodes it lazily when needed.
      state.content.edgeResponse = contentRes;

      // Track last-modified for caching
      const lastModified = extractLastModified(contentRes.headers);
      if (lastModified) {
        recordLastModified(state, res, 'authored-content', lastModified);
      }
    } else {
      log.debug(`Edge content returned ${contentRes.status} for ${contentUrl}`);
    }
  } catch (e) {
    if (e instanceof PipelineStatusError) {
      throw e;
    }
    log.debug(`Failed to fetch edge content from ${contentUrl}: ${e.message}`);
  }
}
