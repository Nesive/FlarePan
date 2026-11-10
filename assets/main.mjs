const THUMBNAIL_SIZE = 144;

/**
 * @param {File} file
 */
export async function generateThumbnail(file) {
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const ctx = canvas.getContext('2d');

  /** @type HTMLImageElement */
  if (file.type.startsWith('image/')) {
    const image = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = URL.createObjectURL(file);
    });
    ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === 'video/mp4') {
    // Generate thumbnail from video
    const video = await new Promise(async (resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.src = URL.createObjectURL(file);
      setTimeout(() => reject(new Error('Video load timeout')), 2000);
      await video.play();
      await video.pause();
      video.currentTime = 0;
      resolve(video);
    });
    ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  }

  /** @type Blob */
  const thumbnailBlob = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob))
  );

  return thumbnailBlob;
}

/**
 * @param {Blob} blob
 */
export async function blobDigest(blob) {
  const digest = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return digestHex;
}

export const SIZE_LIMIT = 100 * 1000 * 1000; // 100MB

/**
 * @param {string} key
 * @param {File} file
 * @param {Record<string, any>} options
 */
export async function multipartUpload(key, file, options) {
  const headers = options?.headers || {};
  headers['content-type'] = file.type;
  // Declared total size: the server quota-checks the upload at create
  // time from this header (and still verifies the real size at
  // complete time, so a wrong value cannot persist an over-quota file).
  headers['fd-total-size'] = String(file.size);

  const uploadId = await axios
    .post(`/api/write/items/${key}?uploads`, '', { headers })
    .then((res) => res.data.uploadId);
  // Chunk size is configurable so callers behind a stricter per-request
  // ceiling (e.g. Cloudflare's 100 MB edge limit) can stay under it;
  // the default keeps the existing frontend behavior unchanged.
  const chunkSize = options?.chunkSize || SIZE_LIMIT;
  const totalChunks = Math.ceil(file.size / chunkSize);

  const promiseGenerator = function* () {
    for (let i = 1; i <= totalChunks; i++) {
      const chunk = file.slice((i - 1) * chunkSize, i * chunkSize);
      const searchParams = new URLSearchParams({ partNumber: i, uploadId });
      yield axios
        .put(`/api/write/items/${key}?${searchParams}`, chunk, {
          onUploadProgress(progressEvent) {
            if (typeof options?.onUploadProgress !== 'function') return;
            options.onUploadProgress({
              loaded: (i - 1) * chunkSize + progressEvent.loaded,
              total: file.size,
            });
          },
        })
        .then((res) => ({
          partNumber: i,
          etag: res.headers.etag,
        }));
    }
  };

  const uploadedParts = [];
  for (const part of promiseGenerator()) {
    const { partNumber, etag } = await part;
    uploadedParts[partNumber - 1] = { partNumber, etag };
  }
  const completeParams = new URLSearchParams({ uploadId });
  await axios.post(`/api/write/items/${key}?${completeParams}`, {
    parts: uploadedParts,
  });
}

/**
 * Copy text to the clipboard, with fallbacks.
 *
 * navigator.clipboard.writeText needs a user gesture: after an awaited
 * network round-trip (e.g. /api/shorten) the transient activation may
 * already be gone, and on iOS Safari / in-app webviews the call then
 * rejects with NotAllowedError even though it started from a click.
 * document.execCommand('copy') is the fallback that still works there;
 * when both fail the caller shows the text in a manual-copy dialog
 * instead of window.prompt (prompt is suppressed in many webviews).
 * Returns true when the text is on the clipboard, false otherwise.
 *
 * @param {string} text
 * @return {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  if (typeof text !== 'string' || !text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fall through to execCommand below.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) {
    return false;
  }
}
