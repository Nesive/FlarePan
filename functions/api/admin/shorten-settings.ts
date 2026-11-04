// Short-link service configuration (cookie-session admin only).
// GET /api/admin/shorten-settings ->
//   { baseUrl, hasToken, configured, source, corrupted }
// PUT /api/admin/shorten-settings { baseUrl, token } ->
//   { baseUrl, hasToken, configured, source, corrupted }
//
// The token value is never returned: GET/PUT only report hasToken.
// PUT semantics: baseUrl as a string is validated ("" clears it);
// a non-empty token is validated then overwrites; a missing or ""
// token preserves the stored token. configured means the stored
// baseUrl and token are both present and valid; a malformed stored
// value reports corrupted:true and counts as unconfigured. source
// is "admin" when the stored config is configured, "env" when the
// stored config is not configured but the deployment env vars
// (SINK_BASE_URL / SINK_SITE_TOKEN) are usable, else "none".

import {
  getShortenSettings,
  isValidShortenBaseUrl,
  isValidShortenToken,
  putShortenSettings,
  requireAdminCookie,
} from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envConfigured(env) {
  const base = env['SINK_BASE_URL'] || '';
  const token = env['SINK_SITE_TOKEN'] || '';
  return isValidShortenBaseUrl(base) && token !== '';
}

function shape(settings, env) {
  return {
    baseUrl: settings.baseUrl,
    hasToken: settings.hasToken,
    configured: settings.configured,
    source: settings.configured ? 'admin' : envConfigured(env) ? 'env' : 'none',
    corrupted: settings.corrupted,
    enabled: settings.enabled !== false,
  };
}

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  const settings = await getShortenSettings(db);
  return json(shape(settings, context.env));
}

export async function onRequestPut(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'bad_request' }, 400);
  }
  const patch = {};
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'invalid_enabled' }, 400);
    }
    patch.enabled = body.enabled;
  }
  if (body.baseUrl !== undefined) {
    if (typeof body.baseUrl !== 'string') {
      return json({ error: 'invalid_baseUrl' }, 400);
    }
    const trimmed = body.baseUrl.trim();
    if (trimmed === '') {
      patch.baseUrl = '';
    } else {
      if (!isValidShortenBaseUrl(trimmed)) {
        return json({ error: 'invalid_baseUrl' }, 400);
      }
      patch.baseUrl = trimmed;
    }
  }
  if (body.token !== undefined) {
    if (typeof body.token !== 'string') {
      return json({ error: 'invalid_token' }, 400);
    }
    // Trim first: pasted leading/trailing whitespace is stripped,
    // not rejected; a value that is blank after trimming preserves
    // the stored token (same as a missing/empty token).
    const trimmed = body.token.trim();
    if (trimmed !== '') {
      if (!isValidShortenToken(trimmed)) {
        return json({ error: 'invalid_token' }, 400);
      }
      patch.token = trimmed;
    }
    // Empty token preserves the stored token (no patch.token set).
  }
  await putShortenSettings(db, patch);
  const settings = await getShortenSettings(db);
  return json(shape(settings, context.env));
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'PUT') return onRequestPut(context);
  return json({ error: 'method_not_allowed' }, 405);
}
