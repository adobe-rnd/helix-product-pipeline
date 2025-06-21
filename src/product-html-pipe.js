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

import { PipelineResponse } from '@adobe/helix-html-pipeline';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import addHeadingIds from './steps/add-heading-ids.js';
import { getPathInfo, validatePathInfo } from './utils/path.js';
import initConfig from './steps/init-config.js';
import fetchContent from './steps/fetch-content.js';
import { setLastModified } from './utils/last-modified.js';
import html from './steps/make-html.js';
import renderBody from './steps/render-body.js';
import renderJsonld from './steps/render-jsonld.js';
import renderHead from './steps/render-head.js';
import tohtml from './steps/stringify-response.js';
import fetch404 from './steps/fetch-404.js';

export async function productHTMLPipe(state, req) {
  const { log } = state;
  state.type = 'html';

  state.info = getPathInfo(state.info.path);

  if (!validatePathInfo(state.info)) {
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': 'invalid path',
      },
    });
  }

  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });

  try {
    await initConfig(state, req, res);

    state.timer?.update('content-fetch');
    await fetchContent(state, req, res);
    if (res.status === 404) {
      await fetch404(state, req, res);
    }

    if (res.error) {
      // if content loading produced an error, we're done.
      const level = res.status >= 500 ? 'error' : 'info';
      log[level](`pipeline status: ${res.status} ${res.error}`);
      res.headers.set('x-error', cleanupHeaderValue(res.error));
      if (res.status < 500) {
        setLastModified(state, res);
      }
      return res;
    }

    state.timer?.update('render');
    await html(state);
    await renderHead(state);
    await renderBody(state, req, res);
    await renderJsonld(state, req, res);
    await addHeadingIds(state);
    state.timer?.update('serialize');
    await tohtml(state, req, res);

    setLastModified(state, res);
  } catch (e) {
    res.error = e.message;
  }

  return res;
}
