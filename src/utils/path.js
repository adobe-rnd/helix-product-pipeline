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

/**
 * Returns a path info for the given resource path
 * @param {string} path request path
 * @returns {PathInfo} the path info
 */
export function getPathInfo(path) {
  if (!path) {
    return null;
  }
  if (path === '/') {
    return null;
  }
  if (path.match(/\/\/+/)) {
    return null;
  }
  const segs = path.split('/');
  segs.shift(); // remove _emptyness_ before first slash
  if (segs.indexOf('..') >= 0 || segs.indexOf('.') >= 0) {
    return null;
  }
  const info = {
    selector: '',
    extension: '.json',
    originalExtension: '',
    originalPath: path,
    originalFilename: segs.pop(),
    unmappedPath: '',
  };

  // create the path prefix.. I
  const prefix = segs.join('/');
  if (prefix) {
    info.pathPrefix = `/${prefix}`;
  } else {
    info.pathPrefix = '/';
  }

  let fileName = info.originalFilename;
  segs.push(fileName);

  if (!fileName.endsWith('.json')) {
    if (fileName.endsWith('.xml')) {
      info.extension = '.xml';
    } else {
      fileName = `${fileName}.json`;
    }
  }

  info.path = `/${segs.join('/')}`;
  segs[segs.length - 1] = fileName;
  info.resourcePath = `/${segs.join('/')}`;
  return info;
}

/**
 * Validates the path info
 * @param {PathInfo} info Info to valida
 * @return {boolean} {@code true} if valid.
 */
export function validatePathInfo(info) {
  if (!info) {
    return false;
  }

  return true;
}
