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

import { appendFilenameToMediaUrl } from '@dylandepass/helix-product-shared';

function transformImage(image) {
  if (!image || typeof image !== 'object') {
    return;
  }
  image.url = appendFilenameToMediaUrl(image.url, image.filename);
}

export default async function transformImages(state) {
  const data = state?.content?.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (Array.isArray(data.images)) {
    data.images.forEach(transformImage);
  }
  if (Array.isArray(data.variants)) {
    data.variants.forEach((variant) => (variant?.images || []).forEach(transformImage));
  }
}
