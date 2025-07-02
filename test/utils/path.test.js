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

/* eslint-env mocha */

import assert from 'assert';
import {
  getPathInfo,
  validatePathInfo,
} from '../../src/utils/path.js';

describe('Path Utils Test', () => {
  describe('getPathInfo', () => {
    it('should default to "/" for falsy path', () => {
      const result = getPathInfo(null);
      assert.deepStrictEqual(result, null);

      const result2 = getPathInfo(undefined);
      assert.deepStrictEqual(result2, null);

      const result3 = getPathInfo('');
      assert.deepStrictEqual(result3, null);
    });

    it('should return null for path with consecutive slashes', () => {
      assert.strictEqual(getPathInfo('///'), null);
      assert.strictEqual(getPathInfo('/path//to/file'), null);
      assert.strictEqual(getPathInfo('/path///to/file'), null);
      assert.strictEqual(getPathInfo('///path/to/file'), null);
      assert.strictEqual(getPathInfo('/path/to///file'), null);
    });

    it('should return null for path with relative segments', () => {
      assert.strictEqual(getPathInfo('/path/../file'), null);
      assert.strictEqual(getPathInfo('/path/./file'), null);
      assert.strictEqual(getPathInfo('/../file'), null);
      assert.strictEqual(getPathInfo('/./file'), null);
      assert.strictEqual(getPathInfo('/path/../../file'), null);
    });

    it('should handle single file path correctly', () => {
      const result = getPathInfo('/file');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/file',
        originalFilename: 'file',
        unmappedPath: '',
        pathPrefix: '/',
        path: '/file',
        resourcePath: '/file.json',
      });
    });

    it('should handle file path with .json extension correctly', () => {
      const result = getPathInfo('/file.json');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/file.json',
        originalFilename: 'file.json',
        unmappedPath: '',
        pathPrefix: '/',
        path: '/file.json',
        resourcePath: '/file.json',
      });
    });

    it('should handle nested path correctly', () => {
      const result = getPathInfo('/path/to/file');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/path/to/file',
        originalFilename: 'file',
        unmappedPath: '',
        pathPrefix: '/path/to',
        path: '/path/to/file',
        resourcePath: '/path/to/file.json',
      });
    });

    it('should handle nested path with .json extension correctly', () => {
      const result = getPathInfo('/path/to/file.json');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/path/to/file.json',
        originalFilename: 'file.json',
        unmappedPath: '',
        pathPrefix: '/path/to',
        path: '/path/to/file.json',
        resourcePath: '/path/to/file.json',
      });
    });

    it('should handle path with dots in filename correctly', () => {
      const result = getPathInfo('/en/header.plain.json');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/en/header.plain.json',
        originalFilename: 'header.plain.json',
        unmappedPath: '',
        pathPrefix: '/en',
        path: '/en/header.plain.json',
        resourcePath: '/en/header.plain.json',
      });
    });

    it('should handle complex nested path with dots in filename correctly', () => {
      const result = getPathInfo('/en/express/index.plain.json');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/en/express/index.plain.json',
        originalFilename: 'index.plain.json',
        unmappedPath: '',
        pathPrefix: '/en/express',
        path: '/en/express/index.plain.json',
        resourcePath: '/en/express/index.plain.json',
      });
    });

    it('should handle path with multiple segments correctly', () => {
      const result = getPathInfo('/a/b/c/d/e/file');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/a/b/c/d/e/file',
        originalFilename: 'file',
        unmappedPath: '',
        pathPrefix: '/a/b/c/d/e',
        path: '/a/b/c/d/e/file',
        resourcePath: '/a/b/c/d/e/file.json',
      });
    });

    it('should handle path with special characters in filename', () => {
      const result = getPathInfo('/path/file-name_with_underscores');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/path/file-name_with_underscores',
        originalFilename: 'file-name_with_underscores',
        unmappedPath: '',
        pathPrefix: '/path',
        path: '/path/file-name_with_underscores',
        resourcePath: '/path/file-name_with_underscores.json',
      });
    });

    it('should handle path with numbers in filename', () => {
      const result = getPathInfo('/path/file123');
      assert.deepStrictEqual(result, {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/path/file123',
        originalFilename: 'file123',
        unmappedPath: '',
        pathPrefix: '/path',
        path: '/path/file123',
        resourcePath: '/path/file123.json',
      });
    });

    it('should handle path with empty segments correctly', () => {
      const result = getPathInfo('/path//to/file');
      assert.strictEqual(result, null);
    });
  });

  describe('validatePathInfo', () => {
    it('should return false for null info', () => {
      assert.strictEqual(validatePathInfo(null), false);
    });

    it('should return false for undefined info', () => {
      assert.strictEqual(validatePathInfo(undefined), false);
    });

    it('should return false for falsy info', () => {
      assert.strictEqual(validatePathInfo(false), false);
      assert.strictEqual(validatePathInfo(0), false);
      assert.strictEqual(validatePathInfo(''), false);
    });

    it('should return true for valid info object', () => {
      const validInfo = {
        selector: '',
        extension: '.json',
        originalExtension: '',
        originalPath: '/test',
        originalFilename: 'test',
        unmappedPath: '',
        pathPrefix: '/',
        path: '/test',
        resourcePath: '/test.json',
      };
      assert.strictEqual(validatePathInfo(validInfo), true);
    });

    it('should return true for info object with any truthy value', () => {
      assert.strictEqual(validatePathInfo({}), true);
      assert.strictEqual(validatePathInfo({ someProperty: 'value' }), true);
      assert.strictEqual(validatePathInfo({ empty: '' }), true);
      assert.strictEqual(validatePathInfo({ zero: 0 }), true);
    });
  });
});
