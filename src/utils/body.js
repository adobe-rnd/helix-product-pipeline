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
 * Renders all parts once and discards them. Rendering is deterministic, so a
 * dry run inside the pipe turns a rendering error into a 500 before the
 * response starts. Without it, the error would surface mid-stream, after the
 * 200 and its cache headers, and the runtime ends such a response like a
 * complete one, so a CDN could cache the truncated body.
 *
 * @param {Iterable<string>} parts
 */
export function renderOnce(parts) {
  const it = parts[Symbol.iterator]();
  while (!it.next().done);
}

/**
 * Turns rendered parts into a response body that is encoded to UTF-8 a chunk
 * at a time, as the response is read.
 *
 * Large indices and feeds would otherwise become one flat output string (two
 * bytes per character as soon as it contains a character above U+00FF, e.g.
 * ’ or ™) plus its UTF-8 copy in the response, on top of the parsed store.
 *
 * Callers make sure rendering can't fail (see `renderOnce`). If it still does,
 * the error is logged and the stream errored.
 *
 * @param {Iterable<string>} parts
 * @param {{ log?: { error: Function }, name?: string }} [opts]
 * @returns {ReadableStream<Uint8Array>}
 */
export function toStreamBody(parts, { log, name = 'body' } = {}) {
  const encoder = new TextEncoder();
  const it = parts[Symbol.iterator]();
  return new ReadableStream({
    pull(controller) {
      try {
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
      } catch (e) {
        log?.error(`${name} rendering failed mid-response: ${/** @type {Error} */ (e).message}`, e);
        controller.error(e);
      }
    },
    cancel() {
      it.return?.();
    },
  });
}
