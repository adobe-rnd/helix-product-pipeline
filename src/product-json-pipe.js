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
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { validatePathInfo } from './utils/path.js';
import initConfig from './steps/init-config.js';
import fetchContent from './steps/fetch-content.js';
import { setLastModified } from './utils/last-modified.js';
import { set404CacheHeaders, setProductCacheHeaders } from './steps/set-cache-headers.js';

export async function productJSONPipe(state, req) {
  const { log, info } = state;
  const { extension } = info;
  state.type = 'json';

  if (!validatePathInfo(state.info)) {
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': 'invalid path',
      },
    });
  }

  if (extension !== '.json') {
    log.error('only json resources supported.');
    return new PipelineResponse('', {
      status: 400,
      headers: {
        'x-error': 'only json resources supported.',
      },
    });
  }

  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'application/json',
    },
  });

  try {
    await initConfig(state, req, res);

    state.timer?.update('content-fetch');
    await fetchContent(state, req, res);
    if (res.error) {
      if (res.status < 400) {
        return res;
      }
      throw new PipelineStatusError(res.status, res.error);
    }

    // set surrogate keys
    await setProductCacheHeaders(state, req, res);

    setLastModified(state, res);

    res.body = JSON.stringify(state.content.data, null, 2);
  } catch (e) {
    const errorRes = new PipelineResponse('', {
      status: e instanceof PipelineStatusError ? e.code : 500,
    });
    const level = errorRes.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${errorRes.status} ${e.message}`, e);
    errorRes.body = '';
    errorRes.headers.set('x-error', cleanupHeaderValue(e.message));
    if (errorRes.status === 404) {
      await set404CacheHeaders(state, req, errorRes);
    }
    return errorRes;
  }

  return res;
}
