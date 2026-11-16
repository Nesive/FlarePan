// Mount providers (admin-managed, D1 settings table).
// GET /api/admin/mounts -> { providers: [{ id, name, description,
//   comingSoon, enabled, configured, corrupted, hasSecret, clientId, redirectUri, scopes }] }
// POST /api/admin/mounts { provider, enabled, client_id, client_secret, redirect_uri }
//   -> the updated provider status (same shape, one item).
// Scopes are read-only (the OAuth flow always requests drive.readonly);
// the Client Secret is never serialized: GET returns hasSecret only, and a
// POST with an empty/missing client_secret keeps the stored secret.
// Only Google Drive is configurable for now; OneDrive / Dropbox are
// coming-soon placeholders and reject POST with 400.

import {
  MOUNT_PROVIDERS,
  getMountConfig,
  isValidMountClientId,
  isValidMountRedirectUri,
  listMountProviders,
  putMountConfig,
  requireAdminCookie,
} from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  return json({ providers: await listMountProviders(db) });
}

export async function onRequestPost(context) {
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

  const providerId = typeof body.provider === 'string' ? body.provider : '';
  const provider = MOUNT_PROVIDERS.find((p) => p.id === providerId);
  if (!provider || provider.comingSoon) {
    return json({ error: 'unknown_provider' }, 400);
  }

  // Validate the patch. Undefined = preserve; empty client_secret = keep
  // the stored secret; empty client_id / redirect_uri = clear that field
  // (the provider then reads as unconfigured, never as corrupted).
  const patch = {};
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'invalid_enabled' }, 400);
    }
    patch.enabled = body.enabled;
  }
  if (body.client_id !== undefined) {
    if (typeof body.client_id !== 'string') {
      return json({ error: 'invalid_client_id' }, 400);
    }
    const v = body.client_id.trim();
    if (v !== '' && !isValidMountClientId(v)) {
      return json({ error: 'invalid_client_id' }, 400);
    }
    patch.clientId = v;
  }
  if (body.client_secret !== undefined) {
    if (typeof body.client_secret !== 'string') {
      return json({ error: 'invalid_client_secret' }, 400);
    }
    const v = body.client_secret;
    if (v !== '' && /\s/.test(v)) {
      return json({ error: 'invalid_client_secret' }, 400);
    }
    patch.clientSecret = v;
  }
  if (body.redirect_uri !== undefined) {
    if (typeof body.redirect_uri !== 'string') {
      return json({ error: 'invalid_redirect_uri' }, 400);
    }
    const v = body.redirect_uri.trim();
    if (v !== '') {
      if (!isValidMountRedirectUri(v)) {
        return json({ error: 'invalid_redirect_uri' }, 400);
      }
      // The redirect URI must belong to this site (same origin as the
      // request); a foreign redirect URI would break OAuth and could be
      // abused, so it is rejected here rather than at authorize time.
      const siteOrigin = new URL(context.request.url).origin;
      if (new URL(v).origin !== siteOrigin) {
        return json({ error: 'redirect_uri_not_same_origin' }, 400);
      }
    }
    patch.redirectUri = v;
  }

  await putMountConfig(db, providerId, patch);
  const cfg = await getMountConfig(db, providerId);
  return json({
    provider: {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      comingSoon: provider.comingSoon,
      enabled: cfg.enabled,
      configured: cfg.configured,
      corrupted: cfg.corrupted,
      hasSecret: cfg.hasSecret,
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
      scopes: cfg.scopes,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
