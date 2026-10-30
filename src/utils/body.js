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

/** Characters collected before a chunk is UTF-8 encoded. */
export const CHUNK_CHARS = 256 * 1024;

/**
 * Joins rendered parts into a string. Used where the whole output is wanted
 * as a string (tests, small outputs).
 *
 * @param {Iterable<string>} parts
 * @returns {string}
 */
export function joinParts(parts) {
  let out = '';
  for (const part of parts) {
    out += part;
  }
  return out;
}

/**
 * Turns rendered parts into a response body that is encoded to UTF-8 a chunk
 * at a time, as the response is read.
 *
 * Large indices and feeds would otherwise become one flat output string (two
 * bytes per character as soon as it contains a character above U+00FF, e.g.
 * ’ or ™) plus its UTF-8 copy in the response, on top of the parsed store.
 *
 * @param {Iterable<string>} parts
 * @returns {ReadableStream<Uint8Array>}
 */
export function toStreamBody(parts) {
  const encoder = new TextEncoder();
  const it = parts[Symbol.iterator]();
  return new ReadableStream({
    pull(controller) {
      let chunk = '';
      while (chunk.length < CHUNK_CHARS) {
        const { value, done } = it.next();
        if (done) {
          if (chunk) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
          return;
        }
        chunk += value;
      }
      controller.enqueue(encoder.encode(chunk));
    },
    cancel() {
      it.return?.();
    },
  });
}
