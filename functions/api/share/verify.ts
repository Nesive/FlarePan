// Share verification (public). POST /api/share/verify
// { slug, code } -> on success { ok: true, prefix } plus a
// Set-Cookie share-grant (HttpOnly, SameSite=Lax, Path=/, 24h).
// The prefix is only revealed after the code checks out.
// Failure shape is deliberately uniform for dead shares:
// nonexistent, disabled, and expired all answer 404 share_invalid
// with no distinction. A wrong code on a live share answers 401
// invalid_code and counts toward lockout; 5 consecutive failures
// lock the share for 15 minutes, during which even the correct
// code is refused (403 share_locked). A successful verify clears
// the failure counter. Best-effort per-isolate rate limit (same
// pattern as the shorten proxy): 60 verify calls per IP per minute.
// No grant is issued when SESSION_SECRET is unset.

import {
  clearShareFailures,
  createShareGrantValue,
  getShareRow,
  recordShareFailure,
  sha256Hex,
  shareGrantCookieHeader,
  timingSafeEqual,
} from '@/utils/read-auth';

function json(body, status, extraHeaders) {
  const headers = { 'Content-Type': 'application/json' };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers,
  });
}

// Best-effort per-isolate rate limit (no KV binding in this project).
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

export async function onRequestPost(context) {
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
  if (!body || typeof body.slug !== 'string' || typeof body.code !== 'string') {
    return json({ error: 'bad_request' }, 400);
  }
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'share_invalid' }, 404);
  const row = await getShareRow(db, body.slug);
  if (!row || !row.enabled) return json({ error: 'share_invalid' }, 404);
  const now = Math.floor(Date.now() / 1000);
  if (row.expiresAt !== null && row.expiresAt <= now) {
    return json({ error: 'share_invalid' }, 404);
  }
  if (row.lockedUntil > now) {
    return json({ error: 'share_locked' }, 403);
  }
  // A stale lock (expired while the row sat untouched) clears on
  // the next attempt so one old lockout cannot linger forever.
  if (row.lockedUntil !== 0 && row.lockedUntil <= now) {
    await clearShareFailures(db, row.slug);
  }
  const hash = await sha256Hex(body.code);
  if (!timingSafeEqual(hash, row.codeHash)) {
    await recordShareFailure(db, row);
    return json({ error: 'invalid_code' }, 401);
  }
  const grant = await createShareGrantValue(context.env, row.slug);
  if (!grant) return json({ error: 'share_not_configured' }, 500);
  await clearShareFailures(db, row.slug);
  return json(
    { ok: true, prefix: row.prefix },
    200,
    { 'Set-Cookie': shareGrantCookieHeader(grant) }
  );
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
