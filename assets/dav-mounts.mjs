// FlarePan 第三方 WebDAV 挂载：前端本地模块（v1 只读）。
//
// 只依赖浏览器内置 API；配置只存在 localStorage（键 pan-dav-mounts），
// 凭据只在请求时附带，绝不写进任何服务端存储。
// 本模块全部是纯函数（除 load/save 外），方便在 Node 里单测解析逻辑。

export const DAV_MOUNTS_KEY = 'pan-dav-mounts';
export const DAV_ACTIVE_KEY = 'pan-dav-active';

// 单文件 PUT 上限（MB）：与代理 DAV_MAX_UPLOAD_BYTES 同值（默认 100MB，
// 即 Cloudflare 区域套餐 Free/Pro 的入站请求体上限；Business 200MB）。
// 前端、代理守卫、提示文案三处用同一个值，不许各写各的。
export const DAV_MAX_UPLOAD_MB = 100;

// ---------------------------------------------------------------------------
// base64 / base64url（UTF-8 安全）。
// ---------------------------------------------------------------------------

export function btoaUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function atobUtf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function base64UrlEncode(str) {
  return btoaUtf8(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return atobUtf8(b64);
}

// ---------------------------------------------------------------------------
// 本地存储：挂载列表（localStorage）与当前挂载（sessionStorage）。
// ---------------------------------------------------------------------------

export function loadMounts() {
  try {
    const raw = localStorage.getItem(DAV_MOUNTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (m) => m && typeof m.id === 'string' && typeof m.url === 'string'
    );
  } catch (e) {
    return [];
  }
}

export function saveMounts(mounts) {
  try {
    localStorage.setItem(DAV_MOUNTS_KEY, JSON.stringify(mounts));
    return true;
  } catch (e) {
    return false;
  }
}

export function newMountId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'm-' + crypto.randomUUID();
  }
  return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// 挂载对象：{ id, name, url, username, password, rememberPassword,
//             mode: 'proxy' | 'direct', createdAt, lastCheckedAt, lastStatus }
export function normalizeMount(input) {
  const url = String(input.url || '').replace(/\/+$/, '');
  return {
    id: input.id || newMountId(),
    name: String(input.name || '') || hostOf(url),
    url,
    username: String(input.username || ''),
    password: String(input.password || ''),
    rememberPassword: input.rememberPassword !== false,
    mode: input.mode === 'direct' ? 'direct' : 'proxy',
    createdAt: input.createdAt || Date.now(),
    lastCheckedAt: input.lastCheckedAt || 0,
    lastStatus: input.lastStatus || '',
  };
}

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

export function loadActiveRef() {
  try {
    const raw = sessionStorage.getItem(DAV_ACTIVE_KEY);
    if (!raw) return null;
    const ref = JSON.parse(raw);
    if (!ref || typeof ref.mountId !== 'string') return null;
    return ref;
  } catch (e) {
    return null;
  }
}

export function saveActiveRef(mountId, cwd) {
  try {
    sessionStorage.setItem(
      DAV_ACTIVE_KEY,
      JSON.stringify({ mountId, cwd: cwd || '' })
    );
  } catch (e) {}
}

export function clearActiveRef() {
  try {
    sessionStorage.removeItem(DAV_ACTIVE_KEY);
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// 扫码解析：优先级见 DESIGN.md §0（第 1 项已用用户真码实测）。
// 返回 { ok: true, mount, source } 或 { ok: false, error }。
// error: 'empty' | 'unrecognized' | 'not_webdav' | 'bad_json' |
//        'nc_unsupported' | 'bad_url'。
// ---------------------------------------------------------------------------

function parseOwlfilesConn(text) {
  const match = text.match(/^https?:\/\/owlfiles\/conn\?si=([A-Za-z0-9\-_]+)/);
  if (!match) return null;
  let decoded = '';
  try {
    decoded = base64UrlDecode(match[1]);
  } catch (e) {
    return { ok: false, error: 'bad_json' };
  }
  // 实测：JSON 尾部多一个 0x0F 控制字符，取到最后一个 } 为止。
  const end = decoded.lastIndexOf('}');
  if (end < 0) return { ok: false, error: 'bad_json' };
  let data;
  try {
    data = JSON.parse(decoded.slice(0, end + 1));
  } catch (e) {
    return { ok: false, error: 'bad_json' };
  }
  if (!data || data.protocol !== 'webdav' || !data.host) {
    return { ok: false, error: 'not_webdav' };
  }
  // 注意：data.pass 是猫头鹰文件内部的加密串，不是真正的 WebDAV 密码，
  // 拿它登录会 401（2026-11-14 用户实测扫码登录不上）。这里只解析
  // 出 host 与用户名供展示，调用方不得把解析结果当成可用挂载直接保存。
  // pass 原样取用（含 % 等字符，不做二次解码）；host 即完整根地址。
  return {
    ok: true,
    mount: {
      name: data.isp_name || hostOf(data.host),
      url: String(data.host).replace(/\/+$/, ''),
      username: String(data.user || ''),
      password: String(data.pass || ''),
    },
    source: 'owlfiles',
  };
}

function parseFlarepanJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'bad_json' };
  }
  if (!data || data.type !== 'webdav' || !data.url) {
    return { ok: false, error: 'not_webdav' };
  }
  return {
    ok: true,
    mount: {
      name: data.name || hostOf(data.url),
      url: String(data.url).replace(/\/+$/, ''),
      username: String(data.username || ''),
      password: String(data.password || ''),
    },
    source: 'flarepan',
  };
}

function parsePlainUrl(text) {
  let url;
  try {
    url = new URL(text);
  } catch (e) {
    return { ok: false, error: 'bad_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'bad_url' };
  }
  const clean = url.origin + url.pathname.replace(/\/+$/, '');
  return {
    ok: true,
    mount: {
      name: url.hostname,
      url: clean,
      username: safeDecode(url.username),
      password: safeDecode(url.password),
    },
    source: 'url',
  };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

export function parseDavQr(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return { ok: false, error: 'empty' };

  // 1. 猫头鹰文件分享二维码：只解析格式（host / 用户名），码里的
  // pass 是加密串、不能直接登录——调用方须按来源 owlfiles 拦截，
  // 不得直接保存为可用挂载（2026-11-14 用户实测扫码登录不上）。
  if (/^https?:\/\/owlfiles\/conn\?si=/.test(text)) {
    return parseOwlfilesConn(text);
  }
  // 2. FlarePan 自有 JSON。
  if (text.startsWith('{')) return parseFlarepanJson(text);
  // 3. owlfiles:// 包裹的 URL（官方只给过 smb 例子，WebDAV 为推断）。
  if (text.startsWith('owlfiles://')) {
    const inner = text.slice('owlfiles://'.length);
    if (/^https?:\/\//.test(inner)) return parsePlainUrl(inner);
    return parseDavQr('https://' + inner);
  }
  // 4. dav:// / davs://（GNOME 约定）。
  if (text.startsWith('dav://') || text.startsWith('davs://')) {
    return parsePlainUrl(
      text.replace(/^davs:\/\//, 'https://').replace(/^dav:\/\//, 'http://')
    );
  }
  // 5. Nextcloud 登录流：v1 不支持，给明确提示。
  if (text.startsWith('nc://login/')) {
    return { ok: false, error: 'nc_unsupported' };
  }
  // 6. 纯 WebDAV URL。
  if (/^https?:\/\//.test(text)) return parsePlainUrl(text);
  return { ok: false, error: 'unrecognized' };
}

export function qrParseErrorText(error) {
  switch (error) {
    case 'empty':
      return '内容为空，请重新扫码或粘贴';
    case 'bad_json':
      return '二维码内容损坏，无法解析，请改手动添加';
    case 'not_webdav':
      return '这不是一个 WebDAV 配置，请改手动添加';
    case 'nc_unsupported':
      return '暂不支持 Nextcloud 登录流二维码，请改手动添加';
    case 'bad_url':
      return '地址格式不正确，请检查后重试';
    default:
      return '无法识别该二维码，请改手动添加';
  }
}

// ---------------------------------------------------------------------------
// 代理 / 直连调用。
// ---------------------------------------------------------------------------

// 挂载内相对路径 → 上游 URL（逐段编码；根目录为空串）。
export function mountTargetUrl(mount, relPath) {
  const segments = String(relPath || '')
    .split('/')
    .filter((s) => s !== '');
  const encoded = segments.map((s) => encodeURIComponent(s)).join('/');
  const base = String(mount.url).replace(/\/+$/, '');
  return encoded ? base + '/' + encoded : base + '/';
}

// 同源代理地址：fetch 调用走 Authorization 头；媒体元素 src 用 withAuth。
export function buildProxyUrl(mount, relPath, options) {
  const opts = options || {};
  const u = base64UrlEncode(String(mount.url).replace(/\/+$/, ''));
  const p = encodeURIComponent(String(relPath || ''));
  let url = '/api/dav-proxy?u=' + u + '&p=' + p;
  if (opts.withAuth) {
    const password =
      opts.password !== undefined ? opts.password : mount.password || '';
    url += '&a=' + btoaUtf8(mount.username + ':' + password);
  }
  return url;
}

// 媒体元素（<img>/<video>/<audio>/<iframe>）用的代理地址：带 a 参数。
export function mediaProxyUrl(mount, relPath, password) {
  return buildProxyUrl(mount, relPath, { withAuth: true, password });
}

// 基本鉴权头（UTF-8 安全）。
export function basicAuthHeader(username, password) {
  return 'Basic ' + btoaUtf8(username + ':' + password);
}

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8" ?>' +
  '<D:propfind xmlns:D="DAV:"><D:prop>' +
  '<D:displayname/><D:getcontentlength/><D:getcontenttype/>' +
  '<D:getlastmodified/><D:getetag/><D:resourcetype/>' +
  '</D:prop></D:propfind>';

// 对挂载发一次请求。direct 模式先直连，遇网络/CORS 失败自动切中转一次。
// 返回 { res, via: 'proxy' | 'direct', fellBack: boolean }。
// 写操作扩展（v2）：
//   PUT：opts.body（File/Blob/string，流式透传）+ opts.contentType +
//        opts.contentLength（file.size，代理守卫用）；
//   MOVE/COPY：opts.destination（挂载内目标相对路径，拼完整 URL 放
//        Destination 头）+ opts.overwrite（'T' | 'F'，默认 'F'）。
export async function davFetch(mount, relPath, options) {
  const opts = options || {};
  const method = opts.method || 'PROPFIND';
  const password =
    opts.password !== undefined ? opts.password : mount.password || '';
  const headers = new Headers(opts.headers || {});
  if (password || mount.username) {
    headers.set('Authorization', basicAuthHeader(mount.username, password));
  }
  if (method === 'PROPFIND') {
    headers.set('Depth', String(opts.depth !== undefined ? opts.depth : 1));
    headers.set('Content-Type', 'application/xml; charset=utf-8');
  }
  if (method === 'PUT') {
    // 不设 PROPFIND 专用的 Depth 与 application/xml；类型与长度由调用方给。
    if (opts.contentType) headers.set('Content-Type', opts.contentType);
    if (opts.contentLength !== undefined && opts.contentLength !== null) {
      headers.set('Content-Length', String(opts.contentLength));
    }
  }
  if (method === 'MOVE' || method === 'COPY') {
    // 目标相对路径先校验（空、含 ..、以 / 开头 → 直接抛错，不发请求）；
    // 拼成完整上游 URL 放 Destination 头（代理再校验 + 改写）。
    const dest = String(opts.destination || '');
    if (
      !dest ||
      dest.startsWith('/') ||
      dest.split('/').some((s) => s === '..' || s === '.')
    ) {
      throw new Error('bad_destination');
    }
    headers.set('Destination', mountTargetUrl(mount, dest));
    headers.set('Overwrite', opts.overwrite === 'T' ? 'T' : 'F');
  }

  const proxyUrl = buildProxyUrl(mount, relPath);
  const proxyInit = {
    method,
    headers,
    body:
      method === 'PROPFIND'
        ? PROPFIND_BODY
        : method === 'PUT'
          ? opts.body
          : undefined,
    signal: opts.signal,
  };

  if (mount.mode !== 'direct') {
    const res = await fetch(proxyUrl, proxyInit);
    return { res, via: 'proxy', fellBack: false };
  }

  // 直连：只有网络层失败（CORS 被拦也表现为 TypeError）才切中转。
  try {
    const res = await fetch(mountTargetUrl(mount, relPath), {
      method,
      headers,
      body:
        method === 'PROPFIND'
          ? PROPFIND_BODY
          : method === 'PUT'
            ? opts.body
            : undefined,
      signal: opts.signal,
    });
    return { res, via: 'direct', fellBack: false };
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    const res = await fetch(proxyUrl, proxyInit);
    return { res, via: 'proxy', fellBack: true };
  }
}

// ---------------------------------------------------------------------------
// 写操作薄 helper（v2）：返回 { ok, status, error }，error 见附录映射。
// ---------------------------------------------------------------------------

export async function davPut(mount, relPath, body, options) {
  const opts = options || {};
  try {
    const { res } = await davFetch(mount, relPath, {
      method: 'PUT',
      body,
      contentType: opts.contentType,
      contentLength: opts.contentLength,
      password: opts.password,
      headers: opts.headers,
      signal: opts.signal,
    });
    return {
      ok: res.status === 200 || res.status === 201 || res.status === 204,
      status: res.status,
      error: '',
    };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, status: 0, error: 'aborted' };
    return { ok: false, status: 0, error: 'network' };
  }
}

export async function davDelete(mount, relPath, options) {
  const opts = options || {};
  try {
    const { res } = await davFetch(mount, relPath, {
      method: 'DELETE',
      password: opts.password,
      signal: opts.signal,
    });
    return {
      ok: res.status === 200 || res.status === 204,
      status: res.status,
      error: '',
    };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, status: 0, error: 'aborted' };
    return { ok: false, status: 0, error: 'network' };
  }
}

export async function davMkcol(mount, relPath, options) {
  const opts = options || {};
  try {
    const { res } = await davFetch(mount, relPath, {
      method: 'MKCOL',
      password: opts.password,
      signal: opts.signal,
    });
    return {
      ok: res.status === 201,
      status: res.status,
      error: '',
    };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, status: 0, error: 'aborted' };
    return { ok: false, status: 0, error: 'network' };
  }
}

export async function davMove(mount, fromRel, toRel, overwrite, options) {
  const opts = options || {};
  try {
    const { res } = await davFetch(mount, fromRel, {
      method: 'MOVE',
      destination: toRel,
      overwrite: overwrite === 'T' ? 'T' : 'F',
      password: opts.password,
      signal: opts.signal,
    });
    return {
      ok: res.status === 201 || res.status === 204,
      status: res.status,
      error: '',
    };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, status: 0, error: 'aborted' };
    if (e && e.message === 'bad_destination') return { ok: false, status: 0, error: 'bad_destination' };
    return { ok: false, status: 0, error: 'network' };
  }
}

export async function davCopy(mount, fromRel, toRel, overwrite, options) {
  const opts = options || {};
  try {
    const { res } = await davFetch(mount, fromRel, {
      method: 'COPY',
      destination: toRel,
      overwrite: overwrite === 'T' ? 'T' : 'F',
      password: opts.password,
      signal: opts.signal,
    });
    return {
      ok: res.status === 201 || res.status === 204,
      status: res.status,
      error: '',
    };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, status: 0, error: 'aborted' };
    if (e && e.message === 'bad_destination') return { ok: false, status: 0, error: 'bad_destination' };
    return { ok: false, status: 0, error: 'network' };
  }
}

// PUT 的 Content-Type：file.type 为空时按扩展名猜（与代理的 MIME_BY_EXT
// 同一张表；.md 用 text/markdown）。
const DAV_MIME_BY_EXT = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/opus',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', mkv: 'video/x-matroska',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  pdf: 'application/pdf', txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8', json: 'application/json',
  html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript',
};

export function guessDavContentType(name) {
  const m = String(name || '').match(/\.([A-Za-z0-9]+)$/);
  if (!m) return 'application/octet-stream';
  return DAV_MIME_BY_EXT[m[1].toLowerCase()] || 'application/octet-stream';
}

// 上传进度必须用 XHR（fetch 没有上传进度事件）：
//   XMLHttpRequest + xhr.upload.onprogress + Authorization 头 + File 作 body。
// 直连模式：XHR 发到 mountTargetUrl，网络层失败（CORS 预检被拦也表现为
// 网络错误）时按 davFetch 同款逻辑回退到代理地址重发一次；HTTP 错误状态
// 不触发回退。返回 Promise<{ status, fellBack }>；取消时 reject AbortError。
export function davUploadXhr(mount, relPath, file, options) {
  const opts = options || {};
  const password =
    opts.password !== undefined ? opts.password : mount.password || '';
  const contentType = file.type || guessDavContentType(file.name);

  const xhrPut = (url) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;
      const abortHandler = () => {
        // 取消时直接 reject，不要只调 xhr.abort()：
        // 若先把 settled 置 true 再 abort，onabort 会因 settled 直接返回、
        // Promise 永远不决议，上传队列卡在 uploading（2026-11-14 E2E 实测）。
        if (settled) return;
        settled = true;
        xhr.abort();
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      if (opts.signal) {
        if (opts.signal.aborted) {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          return;
        }
        opts.signal.addEventListener('abort', abortHandler, { once: true });
      }
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Authorization', basicAuthHeader(mount.username, password));
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (opts.onProgress && e.lengthComputable) {
          opts.onProgress(e.loaded, e.total);
        }
      };
      xhr.onload = () => {
        if (settled) return;
        settled = true;
        if (opts.signal) opts.signal.removeEventListener('abort', abortHandler);
        resolve({ status: xhr.status });
      };
      xhr.onerror = () => {
        if (settled) return;
        settled = true;
        if (opts.signal) opts.signal.removeEventListener('abort', abortHandler);
        reject(new Error('network'));
      };
      xhr.onabort = () => {
        if (settled) return;
        settled = true;
        if (opts.signal) opts.signal.removeEventListener('abort', abortHandler);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      xhr.send(file);
    });

  if (mount.mode !== 'direct') {
    return xhrPut(buildProxyUrl(mount, relPath)).then((r) => ({
      status: r.status,
      fellBack: false,
    }));
  }
  return xhrPut(mountTargetUrl(mount, relPath))
    .then((r) => ({ status: r.status, fellBack: false }))
    .catch((e) => {
      if (e && e.name === 'AbortError') throw e;
      return xhrPut(buildProxyUrl(mount, relPath)).then((r) => ({
        status: r.status,
        fellBack: true,
      }));
    });
}

// 写操作状态码 → 中文提示（唯一出处；前端所有写操作共用，不许各处自造）。
// 代理自身的 { error } 码（too_large / bad_destination / same_destination）
// 按同表译成中文，不直接显示 error 码。
export function davErrorText(status, method) {
  if (status === 200 || status === 201 || status === 204) return '';
  switch (status) {
    case 400:
      return '请求不正确，请检查文件名';
    case 401:
      return '用户名或密码错误';
    case 403:
      return '没有该操作的权限';
    case 404:
      return '文件或文件夹不存在，可能已被删除';
    case 405:
      return method === 'MKCOL'
        ? '已存在同名文件夹或文件'
        : '该服务不支持此操作';
    case 409:
      return method === 'PUT'
        ? '上级文件夹不存在'
        : '文件夹非空且上游拒绝递归删除，请先清空';
    case 412:
      return method === 'MOVE'
        ? '已存在同名文件，换个名字'
        : '文件已被改过';
    case 413:
      return '文件超过单文件 ' + DAV_MAX_UPLOAD_MB + 'MB 上限，无法经中转上传';
    case 423:
      return '文件被锁定，无法操作';
    case 507:
      return '对方空间不足';
    case 502:
    case 504:
      return '服务器无响应，请稍后重试';
    default:
      return '操作失败，请稍后重试';
  }
}

export function davProxyErrorText(error) {
  if (error === 'too_large') {
    return '文件超过单文件 ' + DAV_MAX_UPLOAD_MB + 'MB 上限，无法经中转上传';
  }
  if (error === 'bad_destination') return '请求不正确，请检查文件名';
  if (error === 'same_destination') return '新名字与原来相同';
  if (error === 'bad_overwrite') return '请求不正确，请检查文件名';
  if (error === 'network') return '服务器无响应，请稍后重试';
  if (error === 'aborted') return '已取消';
  return '操作失败，请稍后重试';
}

// ---------------------------------------------------------------------------
// PROPFIND 解析 → /api/children 同款形状 { value: [...], folders: [...] }。
// 文件项：{ key, size, uploaded, httpMetadata: { contentType },
//          customMetadata: {} }；folders 为带尾斜杠的挂载内相对路径。
// ---------------------------------------------------------------------------

function childText(parent, localName) {
  const list = parent.getElementsByTagNameNS('*', localName);
  if (!list || !list.length) return '';
  return (list[0].textContent || '').trim();
}

function hasCollection(parent) {
  const types = parent.getElementsByTagNameNS('*', 'resourcetype');
  if (!types || !types.length) return false;
  const cols = types[0].getElementsByTagNameNS('*', 'collection');
  return !!cols && cols.length > 0;
}

// rootPrefix：挂载根地址的 pathname（如 /dav）；reqRel：本次请求的
// 挂载内相对路径（根目录为空串），用于跳过“自身”那一条。
export function parsePropfind(xmlText, rootPrefix, reqRel) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('bad_xml');
  }
  const responses = doc.getElementsByTagNameNS('*', 'response');
  const files = [];
  const folders = [];
  // 根前缀同样先解码再比对，否则含中文的挂载路径比对不上。
  let root = String(rootPrefix || '').replace(/\/+$/, '');
  try {
    root = decodeURIComponent(root);
  } catch (e) {}
  const reqNorm = String(reqRel || '').replace(/\/+$/, '');

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    let href = childText(resp, 'href');
    if (!href) continue;
    // href 可能是绝对 URL 或绝对路径，且通常是百分号编码态。
    // 先取 pathname（仍为编码态），再统一解码一次——注意不能先解码
    // 再过 new URL：URL 构造器会把 pathname 重新编码，中文名就又变
    // 回 %XX 形式（2026-11-14 实测踩坑）。
    let path = href;
    if (/^https?:\/\//i.test(href)) {
      try {
        path = new URL(href).pathname;
      } catch (e) {
        path = href;
      }
    }
    path = path.split('#')[0].split('?')[0];
    try {
      path = decodeURIComponent(path);
    } catch (e) {
      // 解码失败就按原样用，至少不丢这一条。
    }
    // 去掉挂载根前缀，得到挂载内相对路径。
    let rel = path;
    if (root && path === root) rel = '';
    else if (root && path.startsWith(root + '/')) rel = path.slice(root.length + 1);
    else if (path.startsWith('/')) rel = path.replace(/^\/+/, '');
    rel = rel.replace(/\/+$/, '');
    if (!rel || rel === reqNorm) continue;

    if (hasCollection(resp)) {
      folders.push(rel + '/');
      continue;
    }
    const size = parseInt(childText(resp, 'getcontentlength') || '0', 10) || 0;
    const type = childText(resp, 'getcontenttype') || '';
    const mtime = childText(resp, 'getlastmodified') || '';
    let uploaded = '';
    if (mtime) {
      const d = new Date(mtime);
      if (!isNaN(d.getTime())) uploaded = d.toISOString();
    }
    files.push({
      key: rel,
      size,
      uploaded,
      httpMetadata: { contentType: type },
      customMetadata: {},
    });
  }
  return { value: files, folders };
}

// PROPFIND Depth 0 单条解析（文本编辑冲突检测用）：取第一个 response 的
// getcontentlength / getlastmodified / getetag。返回 null 表示解析失败。
export function parsePropfindOne(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  const responses = doc.getElementsByTagNameNS('*', 'response');
  if (!responses || !responses.length) return null;
  const resp = responses[0];
  const size = parseInt(childText(resp, 'getcontentlength') || '0', 10) || 0;
  const mtime = childText(resp, 'getlastmodified') || '';
  let uploaded = '';
  if (mtime) {
    const d = new Date(mtime);
    if (!isNaN(d.getTime())) uploaded = d.toISOString();
  }
  return {
    size,
    uploaded,
    etag: childText(resp, 'getetag') || '',
  };
}

// ---------------------------------------------------------------------------
// 测试连接：对根目录发 PROPFIND，返回 { ok, count } 或 { ok:false, error }。
// error: 'timeout' | 'auth' | 'not_webdav' | 'unreachable' | 'http_<n>'。
// ---------------------------------------------------------------------------

export async function testMountConnection(mount, password) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const { res } = await davFetch(mount, '', {
      method: 'PROPFIND',
      depth: 1,
      password,
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'auth' };
    }
    if (res.status !== 207 && res.status !== 200) {
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        return { ok: false, error: 'not_webdav' };
      }
      return { ok: false, error: 'http_' + res.status };
    }
    const text = await res.text();
    const rootPrefix = (() => {
      try {
        return new URL(mount.url).pathname;
      } catch (e) {
        return '';
      }
    })();
    const data = parsePropfind(text, rootPrefix, '');
    return { ok: true, count: data.value.length + data.folders.length };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, error: 'timeout' };
    if (e && e.message === 'bad_xml') return { ok: false, error: 'not_webdav' };
    return { ok: false, error: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

export function connectionErrorText(error) {
  if (error === 'timeout') return '连接超时：服务器无响应，请检查地址与端口';
  if (error === 'auth') return '401：用户名或密码错误';
  if (error === 'not_webdav') {
    return '不是有效的 WebDAV 服务：根目录 PROPFIND 未返回合法响应';
  }
  if (error === 'unreachable') return '无法连接服务器，请检查地址与端口';
  if (typeof error === 'string' && error.startsWith('http_')) {
    return '服务器返回 ' + error.slice(5) + '，请检查地址与账号';
  }
  return '连接失败，请稍后重试';
}

// ---------------------------------------------------------------------------
// 分享二维码载荷。
// ---------------------------------------------------------------------------

export function flarepanQrPayload(mount) {
  // 注意：载荷里不放 name——中文名进 qrcodejs 会按 UTF-8 展开计长，
  // 122 字符的载荷会被算成 2564 字节、在 CorrectLevel M 下报
  // code length overflow、画布空白（2026-11-14 实测踩坑）。
  // 接收端解析时无 name 会自动用 host 当名（见 parseFlarepanJson）。
  return JSON.stringify({
    type: 'webdav',
    url: mount.url,
    username: mount.username,
    password: mount.password || '',
  });
}

// 纯 URL 码：只含用户名、不含密码（更安全，对方需手动补密码）。
export function plainUrlQrPayload(mount) {
  try {
    const url = new URL(mount.url);
    if (mount.username) url.username = encodeURIComponent(mount.username);
    return url.toString().replace(/\/+$/, '');
  } catch (e) {
    return mount.url;
  }
}
