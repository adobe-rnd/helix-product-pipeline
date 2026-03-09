/*
 * Copyright 2026 Adobe. All rights reserved.
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
import transformImages from '../../src/steps/transform-images.js';

describe('transform-images', () => {
  describe('image URL transformation', () => {
    it('transforms top-level and variant images using filename field', async () => {
      const state = {
        content: {
          data: {
            images: [{
              url: './media_13f34abcff863c53e25028911749e9a9d1d6f1c4.jpg',
              filename: 'blue-ceramic-mug',
            }],
            variants: [{
              images: [{
                url: './media_a378c3b84062ab2631361994fb52f68090b7ecd6.jpg',
                filename: 'red-mug',
              }],
            }],
          },
        },
      };

      transformImages(state);

      assert.strictEqual(
        state.content.data.images[0].url,
        './media_13f34abcff863c53e25028911749e9a9d1d6f1c4/blue-ceramic-mug.jpg',
      );
      assert.strictEqual(
        state.content.data.variants[0].images[0].url,
        './media_a378c3b84062ab2631361994fb52f68090b7ecd6/red-mug.jpg',
      );
    });

    it('leaves images without filename unchanged', async () => {
      const state = {
        content: {
          data: {
            images: [{
              url: './media_13f34abcff863c53e25028911749e9a9d1d6f1c4.jpg',
            }],
          },
        },
      };

      transformImages(state);

      assert.strictEqual(
        state.content.data.images[0].url,
        './media_13f34abcff863c53e25028911749e9a9d1d6f1c4.jpg',
      );
    });

    it('leaves non-media URLs unchanged', async () => {
      const state = {
        content: {
          data: {
            images: [{
              url: 'https://example.com/photo.jpg',
              filename: 'my-photo',
            }],
          },
        },
      };

      transformImages(state);

      assert.strictEqual(state.content.data.images[0].url, 'https://example.com/photo.jpg');
    });

    it('skips null and non-object entries in images array', async () => {
      const state = {
        content: {
          data: {
            images: [
              null,
              'not-an-object',
              { url: './media_13f34abcff863c53e25028911749e9a9d1d6f1c4.jpg', filename: 'mug' },
            ],
          },
        },
      };

      transformImages(state);

      assert.strictEqual(
        state.content.data.images[2].url,
        './media_13f34abcff863c53e25028911749e9a9d1d6f1c4/mug.jpg',
      );
    });

    it('handles variants with no images array', async () => {
      const state = {
        content: {
          data: {
            variants: [{ name: 'variant-1' }],
          },
        },
      };

      transformImages(state);
      assert.strictEqual(state.content.data.variants[0].name, 'variant-1');
    });
  });

  describe('defensive edge cases', () => {
    it('handles undefined state', async () => {
      transformImages(undefined);
    });

    it('handles state with no content', async () => {
      transformImages({});
    });

    it('handles state with no data', async () => {
      transformImages({ content: {} });
    });

    it('handles state with null data', async () => {
      transformImages({ content: { data: null } });
    });

    it('handles state with non-object data', async () => {
      transformImages({ content: { data: 'string' } });
    });
  });
});
