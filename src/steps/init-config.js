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
import { getOriginalHost } from './utils.js';
import { recordLastModified } from '../utils/last-modified.js';

function replaceParams(str, info) {
  if (!str) {
    return '';
  }
  return str
    .replaceAll('$owner', info.owner)
    .replaceAll('$org', info.org)
    .replaceAll('$site', info.site)
    .replaceAll('$repo', info.repo)
    .replaceAll('$ref', info.ref);
}

/**
 * This function finds ordered matches between a list of patterns and a given path.
 * @param {string[]} patterns - An array of pattern strings to match against.
 * @param {string} path - The path string to match patterns against.
 */
function findOrderedMatches(patterns, path) {
  return patterns
    .map((pattern) => {
      const re = new RegExp(pattern.replace(/\{\{([^}]+)\}\}/g, '([^{]+)').replace(/\*/g, '([^/]+)'));
      const match = path.match(re);
      return match ? pattern : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
}

/**
 * This function extracts path parameters from a pattern and a path.
 * @param {string} pattern - The pattern string.
 * @param {string} path - The path string.
 * @returns {Record<string, string>} - The path parameters.
 */
function extractPathParams(pattern, path) {
  // create a RegExp with named groups from the string contained in '{{}}'
  const re = new RegExp(pattern.replace(/\{\{([^}]+)\}\}/g, '(?<$1>[^{]+)').replace(/\*/g, '([^/]+)'));
  const match = path.match(re);
  /* c8 ignore next */
  return match ? match.groups : {};
}

/**
 * Initializes the pipeline state with the config from the config service
 * (passed via the `config` parameter during state construction).
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default function initConfig(state, req, res) {
  const { config } = state;

  const confMap = config.public.patterns;
  const paths = findOrderedMatches(
    Object.keys(confMap).filter((p) => p !== 'base'),
    state.info.path,
  );

  const resolved = {
    ...paths.reduce((conf, key) => ({
      ...conf,
      ...confMap[key],
      params: {
        ...conf.params,
        ...extractPathParams(key, state.info.path),
      },
    }), {
      ...(confMap.base ?? {}),
      params: {},
    }),
    confMap,
    matchedPatterns: paths,
  };

  state.config.route = resolved;

  // set custom preview and live hosts
  state.previewHost = replaceParams(config.cdn?.preview?.host, state);
  state.liveHost = replaceParams(config.cdn?.live?.host, state);
  state.prodHost = config.cdn?.prod?.host || getOriginalHost(req.headers);
  recordLastModified(state, res, 'config', state.config.lastModified);
}
