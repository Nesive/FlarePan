// FlarePan Google Drive 挂载：只读内容代理。
//
// 浏览器 → 本 Worker → Google Drive API。只做转发：不存 token、
// 不记日志、不写 D1/R2；响应流式透传，不落盘。
//
// 目标固定写死 www.googleapis.com，调用方永远传不了别的目标
// 地址——因此没有 SSRF 面（与 dav-proxy 必须校验任意目标不同）。
// 上游基地址可覆盖（仅本地 stub 测试用）：
//   env.DRIVE_API_BASE（wrangler dev 里指向本地假端点）；
//   未设置时默认 https://www.googleapis.com。
// 生产环境绝不设置该变量——覆盖只在开发期存在。
//
// 鉴权：Authorization 请求头优先；<img> / <video> / <audio> /
// <iframe> 无法带请求头时才用查询参数 t（access_token）。
// t 里只会是短命的 access_token（1 小时过期），refresh_token
// 永远不出现在 URL 里；token 走查询参数时响应强制 no-store。
//
// 只开放 GET（v1 只读）；不跟随重定向——Drive 的 alt=media 与
// export 直接返回内容（200/206），不需要跟随逻辑。
// 同源保护：Origin 头存在且与本站 origin 不一致时拒绝，不做开放代理。

// 上游基地址（未覆盖时）。
const DEFAULT_DRIVE_API_BASE = 'https://www.googleapis.com';

// 文件 id 只接受 Drive 文件 id 的字符集（字母/数字/_/-），1–200 字符。
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_FILE_ID_LENGTH = 200;

// export 参数白名单：原生 Google 文档可导出的目标类型；其余一律 400。
const ALLOWED_EXPORT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

// access_token（查询参数 t）的字符集：Google 的 access_token 是
// ya29. 开头的点分 base64url 串；超出该字符集的一律算非法，
// 防请求头注入（Headers.set 收到非法字符会抛错）。
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._\-~+/=]+$/;
const MAX_TOKEN_LENGTH = 2048;

// 上游响应里可以透传的头；Set-Cookie 等一律剥掉。
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'content-disposition',
  'cache-control',
  'etag',
  'last-modified',
];

function jsonError(status, code) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  if (method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  const requestUrl = new URL(request.url);

  // 同源保护：跨站请求一定带 Origin 头；本站同源请求不带或与本站一致。
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) {
    return jsonError(403, 'forbidden_origin');
  }

  // 文件 id：只接受 [A-Za-z0-9_-]、1–200 字符；其余一律 400。
  const fileId = requestUrl.searchParams.get('f') || '';
  if (
    fileId.length < 1 ||
    fileId.length > MAX_FILE_ID_LENGTH ||
    !FILE_ID_PATTERN.test(fileId)
  ) {
    return jsonError(400, 'bad_file_id');
  }

  // 导出目标类型：只接受白名单；其余一律 400。
  const exportMime = requestUrl.searchParams.get('export');
  if (exportMime !== null && !ALLOWED_EXPORT_MIME_TYPES.includes(exportMime)) {
    return jsonError(400, 'bad_export');
  }

  // 鉴权：Authorization 头优先；t 查询参数只给无法带请求头的
  // 媒体元素用。两者都没有 → 401，不碰上游。
  let authorization = request.headers.get('Authorization') || '';
  const tokenParam = requestUrl.searchParams.get('t');
  const authViaQuery = !authorization && !!tokenParam;
  if (!authorization && tokenParam) {
    if (
      tokenParam.length > MAX_TOKEN_LENGTH ||
      !ACCESS_TOKEN_PATTERN.test(tokenParam)
    ) {
      return jsonError(400, 'bad_auth');
    }
    authorization = 'Bearer ' + tokenParam;
  }
  if (!authorization) {
    return jsonError(401, 'missing_token');
  }

  // 上游基地址：固定目标，调用方改不了；覆盖变量只在本地
  // stub 测试时设置。基地址本身非法属于服务端配置问题。
  const apiBase =
    context.env['DRIVE_API_BASE'] || DEFAULT_DRIVE_API_BASE;
  let baseUrl;
  try {
    baseUrl = new URL(apiBase);
  } catch (e) {
    return jsonError(500, 'server_misconfigured');
  }
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    return jsonError(500, 'server_misconfigured');
  }
  const base = baseUrl.toString().replace(/\/+$/, '');

  let upstreamUrl = base + '/drive/v3/files/' + encodeURIComponent(fileId);
  if (exportMime !== null) {
    upstreamUrl += '/export?mimeType=' + encodeURIComponent(exportMime);
  } else {
    upstreamUrl += '?alt=media';
  }

  const upstreamHeaders = new Headers();
  upstreamHeaders.set('Authorization', authorization);
  // Range 透传：音频/视频才能边下边播、拖进度（上游回 206）。
  const range = request.headers.get('Range');
  if (range !== null) upstreamHeaders.set('Range', range);
  // 上游看到的 Host 由 fetch 按 URL 自动填，不从浏览器透传。

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      // 不跟随重定向：Drive 直接返回内容；上游状态原样透传。
      redirect: 'manual',
    });
  } catch (e) {
    // 上游不可达：502，不回显目标地址。
    return jsonError(502, 'upstream_unreachable');
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  // token 走查询参数时，响应不进浏览器缓存（URL 本身含 token）。
  if (authViaQuery) responseHeaders.set('Cache-Control', 'no-store');
  // 不透传 Set-Cookie 与任何未列出的头。

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
