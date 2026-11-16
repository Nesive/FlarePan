// FlarePan Google Drive 挂载：OAuth 换 token 端点。
//
// 浏览器 → 本 Worker → Google token 端点。只做转发：不存 token、
// 不记日志、不写 D1/R2；Google 的 token JSON 原样转回浏览器。
//
// OAuth 配置（Client ID、Client Secret、重定向 URI）由管理员在管理
// 后台「挂载」页配置，存在 D1 settings 表（key `mount:google-drive`）。
// 本端点只读 D1 配置，不再收前端传来的 clientId，也不再读 Worker
// 环境变量 GOOGLE_DRIVE_CLIENT_SECRET（该密钥已废弃，管理员在管理
// 后台重新填一次后即可删除）。
//
// 换 token 端点可覆盖（仅本地 stub 测试用）：
//   env.DRIVE_TOKEN_ENDPOINT（wrangler dev 里指向本地假端点）；
//   未设置时默认 https://oauth2.googleapis.com/token。
// 生产环境绝不设置该变量——覆盖端点只在开发期存在。

// Google token 端点（未覆盖时）。
const DEFAULT_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

import { getMountConfig } from '@/utils/read-auth';

function jsonError(status, code) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 非空字符串校验：缺字段、空串、非字符串一律算缺失。
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

// 向 Google token 端点发一次换 token 请求（表单编码；
// Google 的 token 端点只接受 application/x-www-form-urlencoded，
// 不接受 JSON 体）。成功与失败的响应体都原样返回给调用方，
// 由调用方按设计文档 §8 分流（invalid_grant / invalid_client 等）。
async function postTokenEndpoint(tokenEndpoint, params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.set(key, value);
  }
  // 手动挡重定向：client_secret 绝不能跟随跳转发到别处。
  const upstream = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'manual',
  });
  const text = await upstream.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    // Google 的 token 端点恒返回 JSON；非 JSON 响应说明上游
    // 不是预期的端点（例如覆盖的 stub 配错了），不原样透传。
    return new Response(JSON.stringify({ error: 'upstream_unreachable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // 成功与 Google 报错（invalid_grant / invalid_client 等）
  // 都按 Google 的原状态码、原 JSON 体透传，不改写、不补字段。
  return new Response(JSON.stringify(payload), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  if (method !== 'GET' && method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, POST' },
    });
  }

  const requestUrl = new URL(request.url);

  // 同源保护：跨站请求一定带 Origin 头；本站同源请求不带或与本站一致。
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) {
    return jsonError(403, 'forbidden_origin');
  }

  // ---- GET：只开放状态查询 ----
  if (method === 'GET') {
    if (requestUrl.searchParams.get('status') === '1') {
      // 只报配没配，不返回值；前端据此决定是否显示 Google Drive 入口。
      // 配置来自 D1（管理后台「挂载」页），Client ID 与 Secret 齐全
      // 才算 configured。
      const db = context.env['DB'] || null;
      let configured = false;
      if (db) {
        try {
          const cfg = await getMountConfig(db, 'google-drive');
          configured = cfg.configured;
        } catch {
          configured = false;
        }
      }
      return new Response(JSON.stringify({ configured }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, POST' },
    });
  }

  // ---- POST：只接受 JSON 体 ----
  const contentType = (request.headers.get('Content-Type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    return jsonError(400, 'bad_request');
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError(400, 'bad_request');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError(400, 'bad_request');
  }

  // 动作与必填字段：缺失或非法一律 400，不碰上游。
  // Client ID、Client Secret、重定向 URI 一律读 D1 配置（管理后台
  // 「挂载」页），前端不再传 clientId；redirect_uri 若随请求发来，
  // 必须与 D1 配置一致（Google 要求授权与换 token 用同一个值）。
  const action = body.action;
  let params = null;
  if (action === 'exchange') {
    if (
      !isNonEmptyString(body.code) ||
      !isNonEmptyString(body.codeVerifier)
    ) {
      return jsonError(400, 'bad_request');
    }
    params = {
      code: body.code,
      grant_type: 'authorization_code',
      code_verifier: body.codeVerifier,
    };
  } else if (action === 'refresh') {
    if (!isNonEmptyString(body.refreshToken)) {
      return jsonError(400, 'bad_request');
    }
    params = {
      refresh_token: body.refreshToken,
      grant_type: 'refresh_token',
    };
  } else {
    return jsonError(400, 'bad_request');
  }

  // OAuth 配置来自 D1（管理后台「挂载」页）；未配置或不完整时 500，
  // 且只报“未配置”，绝不回显任何密钥信息。
  const db = context.env['DB'] || null;
  let cfg = null;
  if (db) {
    try {
      cfg = await getMountConfig(db, 'google-drive');
    } catch {
      cfg = null;
    }
  }
  if (!cfg || !cfg.configured) {
    return jsonError(500, 'server_misconfigured');
  }
  if (
    body.redirectUri !== undefined &&
    body.redirectUri !== null &&
    body.redirectUri !== '' &&
    body.redirectUri !== cfg.redirectUri
  ) {
    return jsonError(400, 'bad_request');
  }
  params.client_id = cfg.clientId;
  params.client_secret = cfg.clientSecret;
  // redirect_uri 只在授权码换 token 时需要（须与授权请求用的值一致）；
  // refresh 不用该参数，不发。
  if (action === 'exchange') params.redirect_uri = cfg.redirectUri;

  const tokenEndpoint =
    context.env['DRIVE_TOKEN_ENDPOINT'] || DEFAULT_TOKEN_ENDPOINT;

  try {
    return await postTokenEndpoint(tokenEndpoint, params);
  } catch (e) {
    // 上游不可达：502，不回显端点地址与请求内容。
    return jsonError(502, 'upstream_unreachable');
  }
}
