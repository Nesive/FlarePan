// Shared R2 object serving for /raw/ and WebDAV GET/HEAD.
// Supports a single Range (suffix and open-ended forms); multiple ranges
// are served as a plain 200 (R2 cannot serve multipart ranges).

import { notFound } from '@/utils/bucket';
import { normalizeVideoContentType } from '@/utils/media-types';

function parseRange(header, size) {
  if (!header || !header.startsWith('bytes=')) return null;
  const spec = header.slice('bytes='.length).trim();
  if (spec.includes(',')) return null; // multipart: fall back to full body
  const match = spec.match(/^(\d*)-(\d*)$/);
  if (!match) return { invalid: true };
  const [, startStr, endStr] = match;
  let start;
  let end;
  if (startStr === '' && endStr !== '') {
    // Suffix range: last N bytes.
    const suffix = parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else if (startStr !== '' && endStr === '') {
    start = parseInt(startStr, 10);
    end = size - 1;
  } else if (startStr !== '' && endStr !== '') {
    start = parseInt(startStr, 10);
    end = Math.min(parseInt(endStr, 10), size - 1);
  } else {
    return { invalid: true };
  }
  if (!Number.isFinite(start) || start < 0 || start >= size || end < start) {
    return { invalid: true };
  }
  return { start, end };
}

// Serves key from bucket. method is "GET" or "HEAD". extraHeaders are
// merged in (e.g. long Cache-Control for thumbnails).
export async function serveR2Object(context, bucket, key, extraHeaders) {
  const method = context.request.method;
  const head = await bucket.head(key);
  if (!head) return notFound();

  const size = head.size;
  const headers = new Headers(extraHeaders || {});
  const storedType =
    (head.httpMetadata && head.httpMetadata.contentType) || '';
  // PDF 预览：扩展名是 .pdf 或存量类型就是 PDF 的，一律按 PDF 内联回
  // （2026-11-04 案：历史上传常缺 contentType，存成 octet-stream；
  // 生产响应又带 nosniff，浏览器无法嗅探成 PDF，只能弹下载框）。
  // 内联不影响下载：下载按钮的 download 属性（同源）仍强制下载。
  // 2026-11-04 续案：只改响应头不够——浏览器对无 Cache-Control 的
  // 旧 octet-stream 响应按 Last-Modified 启发式缓存（老文件可达数天），
  // 重试时直接用缓存、根本不到服务器取新头（本地实测证实）。
  // 因此两处同时改：(1) PDF 响应加 no-cache，以后每次必向服务器取
  // 当前头，不再形成新的过期缓存；(2) 前端预览 URL 加 ?preview=1，
  // 换一个缓存键，绕过浏览器里已有的旧 octet-stream 缓存条目。
  const isPdf = /\.pdf$/i.test(key) || storedType === 'application/pdf';
  // 视频：历史上传常缺 contentType，存成 octet-stream；iOS Safari 的
  // <video> 不接受 octet-stream（且生产响应禁嗅探），会直接拒绝内联
  // 播放、退到原生播放器（看起来像跳出网站）。存量类型未知时按扩展
  // 名补一个真正的视频类型，并加 no-cache（同 PDF 案：已缓存的旧
  // octet-stream 响应会被浏览器沿用数天）；前端视频 URL 另带 ?play=1
  // 换缓存键，绕过已有的旧缓存条目。
  const normalizedVideoType = normalizeVideoContentType(key, storedType);
  const contentType = isPdf
    ? 'application/pdf'
    : normalizedVideoType || storedType || 'application/octet-stream';
  headers.set('Content-Type', contentType);
  if (isPdf) {
    headers.set('Content-Disposition', 'inline');
    headers.set('Cache-Control', 'no-cache');
  }
  if (normalizedVideoType) {
    headers.set('Cache-Control', 'no-cache');
  }
  headers.set('Accept-Ranges', 'bytes');
  if (head.httpEtag) headers.set('ETag', head.httpEtag);
  if (head.uploaded) headers.set('Last-Modified', head.uploaded.toUTCString());

  const range = parseRange(context.request.headers.get('Range'), size);
  if (range && range.invalid) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  if (method === 'HEAD') {
    headers.set('Content-Length', String(size));
    if (range) {
      headers.set(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${size}`
      );
      headers.set('Content-Length', String(range.end - range.start + 1));
      return new Response(null, { status: 206, headers });
    }
    return new Response(null, { status: 200, headers });
  }

  if (range) {
    const obj = await bucket.get(key, {
      range: { offset: range.start, length: range.end - range.start + 1 },
    });
    if (!obj) return notFound();
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    headers.set('Content-Length', String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers });
  }

  const obj = await bucket.get(key);
  if (!obj) return notFound();
  headers.set('Content-Length', String(size));
  return new Response(obj.body, { status: 200, headers });
}
