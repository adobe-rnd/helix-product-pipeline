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

/*
 * Returns the HTML body for a 401 Unauthorized response.
 * Matches the format returned by Edge Delivery Services.
 * @returns {string} HTML response body
 */
export function getUnauthorizedBody() {
  return `<html>
  <head>
    <meta name="color-scheme" content="light dark" />
  </head>
  <body>
    <pre style="word-wrap: break-word; white-space: pre-wrap;">401 Unauthorized</pre>
  </body>
</html>`;
}
