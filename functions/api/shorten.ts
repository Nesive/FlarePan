// POST /api/shorten — creates (or reuses) a short link for a file or
// folder on this site, via the Sink service.
//
// The browser never touches the Sink site token: this proxy resolves
// it from the admin-managed D1 settings first, falling back to the
// Pages secrets (SINK_BASE_URL / SINK_SITE_TOKEN), and only ever
// shortens same-site /raw/, /?p= or /s/ targets.
// Short links are pure redirects and grant no access: opening one still
// goes through /raw/ folder protection, or the share page's extraction code.
//
// Request: { "target": "/raw/App/Zoom/Zoom.apk" } or { "target":
// "/?p=App/Zoom/" }
//           or { "target": "/s/<share-slug>" }
//           or { "target": "/s/<share-slug>?code=<code>" }
// Response: { "shortLink": "https://short.example/<slug>", "slug", "target",
// "status" }
//
// Slug policy: the first 12 characters of a 5-bit encoding of the
// SHA-256 of the absolute target URL, over Sink's nanoid alphabet
// (no confusing 0/1/l/o). The same target always yields the same slug,
// and Sink upsert returns the existing link for a taken slug — the proxy
// verifies the returned link points at the same target and errors out
// rather than silently returning a wrong chain on collision.

import { sha256Hex } from '@/utils/read-auth';
import {
  authRequiredResponseNoChallenge,
  canReadPath,
  configCorruptResponse,
  forbiddenResponse,
  getPermissionsConfig,
  getProtectionConfig,
  getReadIdentity,
  getShareRow,
  getShortenSettings,
  isProtectedPath,
  recordShareShortlink,
} from '@/utils/read-auth';

const SINK_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const SLUG_LENGTH = 12;

// Best-effort per-isolate rate limit (no KV binding in this project):
// 60 shorten calls per IP per minute. A hard, cross-isolate limit would
// need a KV binding and is noted as follow-up work.
const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = rateBuckets.get(ip);
  if (!entry || now - entry.windowStart >= 60000) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 60;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function encodeKey(key) {
  return key.split('/').map((s) => encodeURIComponent(s)).join('/');
}

// Normalizes a client-supplied target into an absolute same-site URL and
// the R2 path it protects (file key or folder prefix). Returns null when
// the target is not an allowed same-site shape.
function normalizeTarget(target, origin) {
  if (typeof target !== 'string'
  || !target.startsWith('/')
  || target.startsWith('//')) {
    return null;
  }
  if (target.includes('://')) return null;
  try {
    if (target === '/') {
      return { url: `${origin}/`, protectedPath: '' };
    }
    if (target.startsWith('/raw/')) {
      const rawKey = target.slice('/raw/'.length);
      if (!rawKey) return null;
      const decoded = rawKey.split('/').map((s) => decodeURIComponent(s));
      if (decoded.some((s) => s === '')) return null;
      const key = decoded.join('/');
      if (key.startsWith('_$flaredrive$/')) return null;
      return { url: `${origin}/raw/${encodeKey(key)}`, protectedPath: key };
    }
    if (target.startsWith('/s/')) {
      const rest = target.slice('/s/'.length);
      const qIndex = rest.indexOf('?');
      const slug = qIndex === -1 ? rest : rest.slice(0, qIndex);
      if (!slug || !/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return null;
      // 带提取码的短链：目标可带唯一的 ?code= 参数（分享结果框里
      // 一键复制用）；其他查询参数一律拒绝，避免短链指向未预期的地址。
      let code = null;
      if (qIndex !== -1) {
        const params = new URLSearchParams(rest.slice(qIndex + 1));
        const keys = [...params.keys()];
        if (keys.length !== 1 || keys[0] !== 'code') return null;
        code = params.get('code');
        if (!code || !/^[A-Za-z0-9]{1,64}$/.test(code)) return null;
      }
      // 分享页本身凭提取码鉴权；短链只是重定向，不授予任何访问，
      // 因此不设 protectedPath（与文件目标不同）。
      return {
        url: code
          ? `${origin}/s/${slug}?code=${encodeURIComponent(code)}`
          : `${origin}/s/${slug}`,
        protectedPath: '',
        shareSlug: slug,
      };
    }
    if (target.startsWith('/?p=')) {
      const rawPrefix = target.slice('/?p='.length);
      const decoded = rawPrefix
        ? rawPrefix.split('/').map((s) => decodeURIComponent(s))
        : [];
      if (decoded.some((s) => s === '')) return null;
      // 归一为恰好一个尾斜杠：客户端发的是整段 encodeURIComponent 的文件夹
      // （尾斜杠已编成 %2F），旧代码又补一个 "/"，存下的目标成了 "?p=…%2F/"，
      // 访客解码后 cwd 带双斜杠，列表地址以 "//" 结尾而路由不到函数。
      let prefix = decoded.length
        ? `${decoded.join('/').replace(/\/+$/, '')}/`
        : '';
      if (prefix === '/') prefix = '';
      if (prefix.startsWith('_$flaredrive$/')) return null;
      const encoded = decoded.map((s) => encodeURIComponent(s)).join('/');
      return {
        url: prefix
          ? `${origin}/?p=${encoded}${encoded.endsWith('%2F') ? '' : '/'}`
          : `${origin}/`,
        protectedPath: prefix,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function deterministicSlug(absoluteUrl) {
  const hex = await sha256Hex(absoluteUrl);
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  // Sink's nanoid alphabet has 31 symbols, not 32, so a 5-bit group can
  // land on index 31, which has no symbol. Discard such groups and
  // keep consuming bits (deterministic: same target, same slug).
  let buffer = 0;
  let bits = 0;
  let slug = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5 && slug.length < SLUG_LENGTH) {
      bits -= 5;
      const idx = (buffer >> bits) & 31;
      if (idx < SINK_ALPHABET.length) slug += SINK_ALPHABET[idx];
    }
    if (slug.length >= SLUG_LENGTH) break;
  }
  return slug;
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const ip =
    context.request.headers.get('CF-Connecting-IP') ||
    context.request.headers.get('X-Forwarded-For') ||
    'unknown';
  if (rateLimited(ip)) {
    return json({ error: 'rate_limited' }, 429);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const origin = new URL(context.request.url).origin;
  const normalized = normalizeTarget(body && body.target, origin);
  if (!normalized) {
    return json({ error: 'invalid_target' }, 400);
  }

  // Protected targets need an authenticated caller with access first,
  // otherwise the short link itself becomes a bypass.
  const db = context.env['DB'] || null;
  if (!db) return configCorruptResponse();
  const config = await getProtectionConfig(db);
  if (config.corrupted) return configCorruptResponse();
  if (isProtectedPath(normalized.protectedPath, config.protected)) {
    const permConfig = await getPermissionsConfig(db);
    const rules = permConfig.corrupted ? [] : permConfig.rules;
    const identity = await getReadIdentity(context, db);
    if (!identity) return authRequiredResponseNoChallenge();
    if (!canReadPath(normalized.protectedPath,
    identity,
    config.protected,
    rules)) {
      return forbiddenResponse();
    }
  }

  // Short-link configuration: the admin-managed D1 settings win when
  // fully configured; otherwise fall back to the deployment's Pages
  // secrets. Neither set -> shorten_not_configured below.
  const adminShorten = await getShortenSettings(db);
  if (!adminShorten.enabled) {
    return json({ error: 'shortlink_disabled' }, 403);
  }
  let base;
  let token;
  if (adminShorten.configured) {
    base = adminShorten.baseUrl.replace(/\/+$/, '');
    token = adminShorten.token;
  } else {
    base = (context.env['SINK_BASE_URL'] || '').replace(/\/+$/, '');
    token = context.env['SINK_SITE_TOKEN'] || '';
  }
  // Production must be https: the site token must never travel in
  // plaintext to a non-local host. Plain http is accepted ONLY for
  // loopback hosts, which exist solely so the proxy can be verified
  // against a local mock Sink without a real token; a loopback base
  // can never exfiltrate the token anywhere.
  const isLoopback =
    base.startsWith('http://127.0.0.1') || base.startsWith('http://localhost');
  if ((!base.startsWith('https://') && !isLoopback) || !token) {
    // Sink is not wired up yet: report honestly, never fake a link.
    return json({ error: 'shorten_not_configured' }, 503);
  }

  const slug = await deterministicSlug(normalized.url);
  let sinkRes;
  try {
    sinkRes = await fetch(`${base}/api/link/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // The Sink zone's bot mitigation drops non-browser clients
        // (default script UAs get 403 on public paths and dropped
        // connections on API paths); a browser UA keeps this
        // server-to-server call passing as a normal client.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ url: normalized.url, slug }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return json({ error: 'sink_unreachable' }, 502);
  }
  if (!sinkRes.ok) {
    return json({ error: 'sink_error', status: sinkRes.status }, 502);
  }
  let data;
  try {
    data = await sinkRes.json();
  } catch {
    return json({ error: 'sink_bad_response' }, 502);
  }
  if (!data
  || !data.link
  || data.link.url !== normalized.url
  || !data.shortLink) {
    // The slug was already taken by a different target: never return a
    // chain that points somewhere else.
    return json({ error: 'slug_target_mismatch' }, 502);
  }
  // Share targets only: remember which Sink short code belongs to this
  // share, so revoking the share can delete it from Sink. The stored
  // code is the deterministic slug sent in the upsert request, which
  // is also the key Sink's delete endpoint takes. Best-effort: a
  // mapping failure must never fail the shorten itself (the caller
  // still gets a working link); the row is simply absent, and a later
  // revoke then leaves that short link for manual cleanup in Sink.
  // Only existing shares are recorded, so stray /s/ targets never
  // leave orphan mappings behind. targetKind (migration 0006) records
  // whether the short link points at the plain share URL or a
  // with-code URL, so the admin management view can tell them apart.
  if (normalized.shareSlug) {
    const shareRow = await getShareRow(db, normalized.shareSlug);
    if (shareRow) {
      await recordShareShortlink(db, normalized.shareSlug, slug,
        normalized.url.includes('?code=') ? 'with_code' : 'plain');
    }
  }
  return json({
    shortLink: data.shortLink,
    slug,
    target: normalized.url,
    status: data.status || 'ok',
  });
}
