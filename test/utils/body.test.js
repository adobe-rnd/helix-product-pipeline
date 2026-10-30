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

import assert from 'assert';
import { CHUNK_CHARS, joinParts, toStreamBody } from '../../src/utils/body.js';

/**
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {Promise<Uint8Array[]>}
 */
async function readChunks(stream) {
  const chunks = [];
  const reader = stream.getReader();
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) {
      return chunks;
    }
    chunks.push(value);
  }
}

describe('Body Utils Test', () => {
  it('joins parts', () => {
    assert.strictEqual(joinParts(['a', 'b', '™']), 'ab™');
    assert.strictEqual(joinParts([]), '');
  });

  it('encodes parts to UTF-8 in chunks', async () => {
    const big = 'x'.repeat(CHUNK_CHARS);
    const chunks = await readChunks(toStreamBody([big, '’', 'a', big, 'tail']));
    assert.strictEqual(chunks.length, 3);
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    assert.strictEqual(text, `${big}’a${big}tail`);
  });

  it('closes an empty body without chunks', async () => {
    assert.deepStrictEqual(await readChunks(toStreamBody([])), []);
  });

  it('stops rendering when the body is cancelled', async () => {
    let finished = false;
    function* parts() {
      try {
        for (;;) {
          yield 'x'.repeat(1024);
        }
      } finally {
        finished = true;
      }
    }
    const reader = toStreamBody(parts()).getReader();
    await reader.read();
    await reader.cancel();
    assert.strictEqual(finished, true);
  });
});
