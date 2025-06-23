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
import { computeSurrogateKey } from '@adobe/helix-shared-utils';

/**
 * Returns the surrogate key for a content-bus resource
 * based on the contentBusId and the resource path
 * @param state
 * @returns {Promise<string>}
 */
export async function computeContentPathKey(state) {
  const { contentBusId, info } = state;
  const { path } = info;
  return computeSurrogateKey(`${contentBusId}${path}`);
}

/**
 * Returns the surrogate key for a code-bus resource
 * based on the repositry and the resource path
 * @param state
 * @returns {Promise<string>}
 */
export async function computeCodePathKey(state) {
  const {
    owner, repo, ref, info: { path },
  } = state;
  return computeSurrogateKey(`${ref}--${repo}--${owner}${path}`);
}

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function setXSurrogateKeyHeader(state, req, res) {
  const {
    contentBusId, owner, repo, ref, partition,
  } = state;

  // provide either (prefixed) preview or (unprefixed) live content keys
  const contentKeyPrefix = partition === 'preview' ? 'p_' : '';
  const keys = [];
  const hash = await computeContentPathKey(state);
  keys.push(`${contentKeyPrefix}${hash}`);
  keys.push(`${contentKeyPrefix}${contentBusId}_metadata`);
  keys.push(`${ref}--${repo}--${owner}_head`);
  keys.push(`${contentKeyPrefix}${contentBusId}`);

  res.headers.set('x-surrogate-key', keys.join(' '));
}
