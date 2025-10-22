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

import { PipelineResponse, PipelineStatusError } from '@adobe/helix-html-pipeline';
import { validatePathInfo } from './utils/path.js';
import initConfig from './steps/init-config.js';
import fetchMedia from './steps/fetch-media.js';
import { setLastModified } from './utils/last-modified.js';
import { setMediaCacheHeaders } from './steps/set-cache-headers.js';

export async function productMediaPipe(state, req) {
  state.type = 'media';

  if (!validatePathInfo(state.info)) {
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': 'invalid path',
      },
    });
  }

  const res = new PipelineResponse('');

  try {
    await initConfig(state, req, res);

    state.timer?.update('content-fetch');
    await fetchMedia(state, req, res);
    if (res.status === 404) {
      return new PipelineResponse('', {
        status: 404,
        headers: {
          'x-error': 'not found',
        },
      });
    } else if (res.error) {
      if (res.status < 400) {
        return res;
      }
      throw new PipelineStatusError(res.status, res.error);
    }

    setLastModified(state, res);

    await setMediaCacheHeaders(state, req, res);

    res.headers = state.content.headers;
    res.body = state.content.data;
  } catch (e) {
    res.error = e.message;
  }

  return res;
}
