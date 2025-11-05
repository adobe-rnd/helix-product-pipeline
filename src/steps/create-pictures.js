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
import mime from 'mime';
import { h } from 'hastscript';

const BREAK_POINTS = [
  { media: '(min-width: 600px)', width: '2000' },
  { width: '750' },
];

/**
 * Creates an img element
 * @param {string} src The source URL of the image
 * @param {string} alt The alt text of the image
 * @param {string} title The title of the image
 * @param {string} width The width of the image
 * @param {string} height The height of the image
 * @returns {import('hast').Element} The img element
 */
function createImgElement(src, alt, title, width, height) {
  return h('img', {
    loading: 'lazy',
    alt,
    'data-title': title === alt ? undefined : title,
    src,
    width,
    height,
  });
}

/**
 * Creates a picture element with optimized images
 * @param {string} src The source URL of the image
 * @param {string} alt The alt text of the image
 * @param {string} title The title of the image
 * @returns {import('hast').Element} The picture element
 */
export function createOptimizedPicture(src, alt = '', title = undefined) {
  const url = new URL(src, 'https://localhost/');
  const { pathname, hash = '' } = url;
  const props = new URLSearchParams(hash.substring(1));
  // detect bug in media handler that created fragments like `width=800&width=600`
  // eslint-disable-next-line prefer-const
  let [width, height] = props.getAll('width');
  if (props.has('height')) {
    height = props.get('height');
  }

  // Extract filename and check if it starts with 'media_'
  const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
  const isMediaBusFile = filename.startsWith('media_');

  // If not a media file, return a simple picture with just an img tag (no optimization)
  if (!isMediaBusFile) {
    const img = createImgElement(src, alt, title, width, height);
    return h('picture', [img]);
  }

  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);
  const type = mime.getType(pathname);

  const variants = [
    ...BREAK_POINTS.map((br) => ({
      ...br,
      ext: 'webply',
      type: 'image/webp',
    })),
    ...BREAK_POINTS.map((br) => ({
      ...br,
      ext,
      type,
    }))];

  const sources = variants.map((v, i) => {
    const srcset = `.${pathname}?width=${v.width}&format=${v.ext}&optimize=medium`;
    if (i < variants.length - 1) {
      return h('source', {
        type: v.type,
        srcset,
        media: v.media,
      });
    }
    return createImgElement(srcset, alt, title, width, height);
  });

  return h('picture', sources);
}

/**
 * Constructs the image URL
 * @param {PipelineState} state
 * @param {string} urlOrPath The URL or path of the image
 * @returns {string} The constructed image URL
 */
export function constructImageUrl(state, urlOrPath) {
  if (!urlOrPath) {
    return '';
  }

  if (!urlOrPath.startsWith('./') && !urlOrPath.startsWith('/')) {
    return urlOrPath;
  }

  let { pathPrefix } = state.info;
  if (pathPrefix === '/') {
    pathPrefix = '';
  }

  const path = urlOrPath.startsWith('/') ? urlOrPath.slice(1).replace(/\/$/, '') : urlOrPath.slice(2).replace(/\/$/, '');
  const isLive = state.partition === 'live';
  const isPreview = state.partition === 'preview';

  if (isLive && state.prodHost) {
    return `https://${state.prodHost}${pathPrefix}/${path}`;
  }

  if (isPreview && state.previewHost) {
    return `https://${state.previewHost}${pathPrefix}/${path}`;
  }

  return `https://${state.ref}--${state.site}--${state.org}.aem.network${pathPrefix}/${path}`;
}
