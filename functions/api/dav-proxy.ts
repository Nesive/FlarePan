// FlarePan WebDAV 挂载中转代理（v1 只读）。
//
// 浏览器 → 本 Worker → 第三方 WebDAV 服务。只做转发：不存凭据、
// 不记日志、不写 D1/R2；响应流式透传，不落盘。
//
// 凭据与目标由调用方每次请求附带（配置只存在用户浏览器 localStorage）：
//   - 目标根地址：查询参数 u（base64url 编码）或 X-Dav-Target 请求头
//   - 挂载内相对路径：查询参数 p（encodeURIComponent 编码，根目录为空）
//   - 鉴权：Authorization 请求头（优先）；<img> / <video> / <audio> /
//     <iframe> 无法带请求头时才用查询参数 a（base64 编码的 user:pass）。
//
// v1 只开放 PROPFIND / GET / HEAD；写方法一律 405，留给 v2。
// 同源保护：Origin 头存在且与本站 origin 不一致时拒绝，不做开放代理。

// v1 只开放 PROPFIND / GET / HEAD；v2 加写方法（PUT/DELETE/MKCOL/MOVE/COPY）。
// LOCK / UNLOCK 不放行（二阶段不需要）。
const ALLOWED_METHODS = [
  'PROPFIND', 'GET', 'HEAD', 'PUT', 'DELETE', 'MKCOL', 'MOVE', 'COPY',
];

// 单文件 PUT 上限（字节）：与前端 DAV_MAX_UPLOAD_MB 同值（默认 100MB，
// 即 Cloudflare 区域套餐 Free/Pro 的入站请求体上限；Business 200MB）。
// 超限时代理直接回 413，不碰上游。
const DAV_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

// 写方法（绝不跟随重定向：body 流无法重放，跟过去等于把凭据与数据
// 发到别处；上游回 301/302 时原样透传状态 + 同源 Location）。
const WRITE_METHODS = ['PUT', 'DELETE', 'MKCOL', 'MOVE', 'COPY'];

// 转发给上游的请求头白名单：其余一律不转发，Cookie 等绝不外泄。
const FORWARD_REQUEST_HEADERS = [
  'authorization',
  'depth',
  'range',
  'accept',
  'content-type',
  'content-length',
  'destination',
  'overwrite',
  'if-match',
  'if-none-match',
  'if-modified-since',
  'if-range',
];

// 上游响应里可以透传的头；Set-Cookie 等一律剥掉。
// location 不走盲拷：只在与上游同源时才透传（见 onRequest 末尾）。
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag',
  'dav',
  'allow',
  'cache-control',
  'content-disposition',
];

function jsonError(status, code) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// base64url 解码（无填充）：非法字符直接抛错，由调用方转 400。
function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// 内网 / 回环主机：公网部署时禁止中转向它们（防 SSRF）；
// 本地 wrangler dev（本站 host 即 localhost）时放行，测试需要。
function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '[::1]') return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [o1, o2] = [Number(v4[1]), Number(v4[2])];
    if (o1 === 127) return true;
    if (o1 === 10) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 169 && o2 === 254) return true;
  }
  return false;
}

// 相对路径归一：拒绝绝对路径与 .. 穿越；逐段重新编码，防注入。
function normalizeRelPath(raw) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(raw || '');
  } catch (e) {
    return null;
  }
  if (decoded.startsWith('/')) return null;
  const segments = decoded.split('/').filter((s) => s !== '');
  if (segments.some((s) => s === '..' || s === '.')) return null;
  return segments.map((s) => encodeURIComponent(s)).join('/');
}

// MOVE / COPY 的 Destination 校验 + 改写（整个二阶段唯一新增的攻击面）：
//  - 必须是合法 http/https URL；
//  - origin 必须等于本次请求的目标 origin（绝不能指向任意外站）；
//  - 路径必须以挂载根路径（target.pathname）开头（同一挂载根下）；
//  - 去掉根前缀后的相对路径过 normalizeRelPath（拒绝 ..、绝对路径）；
//  - 通过后改写为规范形式（根地址去尾斜杠 + / + 归一化相对路径）。
// 返回 { ok: true, url } 或 { ok: false }。
function validateDestination(raw, target) {
  let dest;
  try {
    dest = new URL(raw);
  } catch (e) {
    return { ok: false };
  }
  if (dest.protocol !== 'http:' && dest.protocol !== 'https:') {
    return { ok: false };
  }
  if (dest.origin !== target.origin) return { ok: false };
  const rootPath = target.pathname.replace(/\/+$/, '');
  let destPath = dest.pathname;
  if (rootPath) {
    if (destPath !== rootPath && !destPath.startsWith(rootPath + '/')) {
      return { ok: false };
    }
    destPath = destPath.slice(rootPath.length);
  }
  const rel = normalizeRelPath(destPath.replace(/^\/+/, ''));
  if (rel === null) return { ok: false };
  const url = target.toString().replace(/\/+$/, '') + (rel ? '/' + rel : '/');
  return { ok: true, url };
}

// 上游重定向跟随（只对 GET / HEAD；PROPFIND 不跟随，body 流无法重放）。
// Cloudreve 等服务会把文件下载 301 到带签名的对象存储地址（本身无需鉴权）；
// 若把 301 原样透传又剥掉 Location，浏览器媒体元素无法跟随、播放失败。
// 跟随时：跨域跳转一律剥离 Authorization（防凭据被带到对象存储），
// 同域才保留；最多跟 5 跳。
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
const MAX_REDIRECTS = 5;

async function fetchUpstream(
  url: string,
  method: string,
  headers: Headers,
  body: BodyInit | undefined
): Promise<Response> {
  let currentUrl = url;
  let currentHeaders = new Headers(headers);
  let currentMethod = method;
  let currentBody: BodyInit | undefined = body;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(currentUrl, {
      method: currentMethod,
      headers: currentHeaders,
      body: currentBody,
      // 手动跟随：由本函数控制每跳的请求头（自动跟随会把凭据带到别处）。
      redirect: 'manual',
    });
    const location = res.headers.get('Location');
    const followable =
      (currentMethod === 'GET' || currentMethod === 'HEAD') &&
      REDIRECT_STATUSES.includes(res.status) &&
      !!location &&
      hop < MAX_REDIRECTS;
    if (!followable) return res;
    let nextUrl: URL;
    try {
      nextUrl = new URL(location as string, currentUrl);
    } catch (e) {
      return res;
    }
    // 跨域跳转：剥离 Authorization（跳转目标是带签名的对象存储地址，
    // 本身无需鉴权；凭据绝不能带到别的域）。
    const nextHeaders = new Headers(currentHeaders);
    if (nextUrl.origin !== new URL(currentUrl).origin) {
      nextHeaders.delete('Authorization');
    }
    // 303 一律转 GET（并丢 body）；其余保持原方法。
    if (res.status === 303) {
      currentMethod = 'GET';
      currentBody = undefined;
    }
    currentUrl = nextUrl.toString();
    currentHeaders = nextHeaders;
    // 释放当前响应体，避免悬挂。
    if (res.body) {
      try {
        await res.body.cancel();
      } catch (e) {}
    }
  }
  // 超过最大跳数：按上游不可达处理，不把重定向透传给浏览器。
  return jsonError(502, 'upstream_unreachable');
}

// 按扩展名猜 Content-Type（只用于上游没给时的补位）。
const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  css: 'text/css',
  js: 'text/javascript',
};

function guessContentType(relPath: string): string | null {
  const m = relPath.match(/\.([A-Za-z0-9]+)$/);
  if (!m) return null;
  return MIME_BY_EXT[m[1].toLowerCase()] || null;
}

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  if (!ALLOWED_METHODS.includes(method)) {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: ALLOWED_METHODS.join(', ') },
    });
  }

  const requestUrl = new URL(request.url);

  // 同源保护：跨站请求一定带 Origin 头；本站同源请求不带或与本站一致。
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) {
    return jsonError(403, 'forbidden_origin');
  }

  // 目标根地址：查询参数 u 优先，X-Dav-Target 头兜底。
  let targetBase = '';
  const uParam = requestUrl.searchParams.get('u');
  if (uParam) {
    if (!/^[A-Za-z0-9\-_]+$/.test(uParam)) {
      return jsonError(400, 'bad_target');
    }
    try {
      targetBase = decodeBase64Url(uParam);
    } catch (e) {
      return jsonError(400, 'bad_target');
    }
  } else {
    targetBase = request.headers.get('X-Dav-Target') || '';
  }
  let target;
  try {
    target = new URL(targetBase);
  } catch (e) {
    return jsonError(400, 'bad_target');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return jsonError(400, 'bad_target');
  }
  // 不回指本站（防循环代理）；公网部署时不碰内网地址。
  if (target.host === requestUrl.host) return jsonError(400, 'bad_target');
  const isLocalDev =
    requestUrl.hostname === 'localhost' ||
    requestUrl.hostname === '127.0.0.1';
  if (!isLocalDev && isPrivateHostname(target.hostname)) {
    return jsonError(400, 'bad_target');
  }

  const relPath = normalizeRelPath(requestUrl.searchParams.get('p') || '');
  if (relPath === null) return jsonError(400, 'bad_path');
  const upstreamUrl =
    target.toString().replace(/\/+$/, '') +
    (relPath ? '/' + relPath : '/');

  // 鉴权：Authorization 头优先；a 查询参数只给无法带请求头的
  // 媒体元素用。a 只接受标准 base64 字符，防请求头注入。
  let authorization = request.headers.get('Authorization') || '';
  const authParam = requestUrl.searchParams.get('a');
  const authViaQuery = !!authParam;
  if (!authorization && authParam) {
    if (!/^[A-Za-z0-9+/=]+$/.test(authParam) || authParam.length > 512) {
      return jsonError(400, 'bad_auth');
    }
    authorization = 'Basic ' + authParam;
  }

  // PROPFIND 只接受 Depth 0 / 1（默认 1）。
  let depth = '1';
  if (method === 'PROPFIND') {
    const rawDepth = request.headers.get('Depth');
    if (rawDepth !== null && rawDepth !== '0' && rawDepth !== '1') {
      return jsonError(400, 'bad_depth');
    }
    depth = rawDepth || '1';
  }

  const upstreamHeaders = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) upstreamHeaders.set(name, value);
  }
  if (authorization) upstreamHeaders.set('Authorization', authorization);
  if (method === 'PROPFIND') upstreamHeaders.set('Depth', depth);
  // 上游看到的 Host 由 fetch 按 URL 自动填，不从浏览器透传。

  let upstream;
  try {
    if (WRITE_METHODS.includes(method)) {
      // ---- 写方法：直通分支，不进 fetchUpstream 的跟随循环 ----
      if (method === 'PUT') {
        // Content-Length 上限守卫：超了直接 413，不碰上游。
        const cl = request.headers.get('Content-Length');
        if (cl !== null) {
          const n = parseInt(cl, 10);
          if (!isNaN(n) && n > DAV_MAX_UPLOAD_BYTES) {
            return jsonError(413, 'too_large');
          }
        }
      }
      if (method === 'MOVE' || method === 'COPY') {
        // Destination 校验 + 改写；Overwrite 只认 T / F，缺失按 F 补。
        const checked = validateDestination(
          request.headers.get('Destination') || '', target);
        if (!checked.ok) return jsonError(400, 'bad_destination');
        if (checked.url === upstreamUrl) {
          return jsonError(403, 'same_destination');
        }
        upstreamHeaders.set('Destination', checked.url);
        const ow = request.headers.get('Overwrite');
        if (ow === null) {
          upstreamHeaders.set('Overwrite', 'F');
        } else if (ow !== 'T' && ow !== 'F') {
          return jsonError(400, 'bad_overwrite');
        }
      }
      upstream = await fetch(upstreamUrl, {
        method,
        headers: upstreamHeaders,
        // PUT 的 body 流式透传（绝不读进内存）；其余写方法无 body。
        body: method === 'PUT' ? request.body : undefined,
        // 手动挡重定向：写方法绝不跟随；上游回 301/302 时原样透传。
        redirect: 'manual',
      });
    } else {
      upstream = await fetchUpstream(
        upstreamUrl,
        method,
        upstreamHeaders,
        // PROPFIND 带查询体（allprop 等）；GET / HEAD 无 body。
        method === 'PROPFIND' ? request.body : undefined
      );
    }
  } catch (e) {
    // 上游不可达：502，不回显目标地址。
    return jsonError(502, 'upstream_unreachable');
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  // Location 只在与上游同源时透传（MKCOL/PUT 的 201 响应里上游常带
  // Location；跨域 Location 一律剥掉，防内网地址外泄）。
  const location = upstream.headers.get('Location');
  if (location) {
    try {
      const locUrl = new URL(location, upstreamUrl);
      if (locUrl.origin === target.origin) {
        responseHeaders.set('Location', location);
      }
    } catch (e) {}
  }
  // 上游没给 Content-Type 时按扩展名补一个（仅 GET/HEAD 的内容响应；
  // Cloudreve 存 R2 的对象常无 Content-Type；媒体元素靠它选解码器，
  // iOS Safari 没它可能播不出）。只补缺失的，绝不覆盖上游给的值。
  if ((method === 'GET' || method === 'HEAD') && !responseHeaders.has('Content-Type')) {
    const guessed = guessContentType(relPath);
    if (guessed) responseHeaders.set('Content-Type', guessed);
  }
  // 凭据走查询参数时，响应不进浏览器缓存（URL 本身含凭据）。
  if (authViaQuery) responseHeaders.set('Cache-Control', 'no-store');
  // 不透传 Set-Cookie 与任何未列出的头。

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
