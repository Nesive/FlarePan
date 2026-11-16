// Mount providers (public): which third-party drives the admin has
// configured and enabled, so the frontend knows which "add mount" entries
// to show. No authentication; the response contains only public values
// (client_id + redirect_uri, needed to build the authorization URL).
// The Client Secret is never included, and unconfigured/disabled
// providers are omitted entirely (the frontend hides them).
//
// GET /api/mounts/providers -> { providers: [{ id, name, client_id, redirect_uri }] }

import { getPublicMountProviders } from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const requestUrl = new URL(request.url);

  // Same-origin protection: a cross-site request always carries an Origin
  // header; a same-site request carries none or the site's own origin.
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) {
    return json({ error: 'forbidden_origin' }, 403);
  }

  const db = context.env['DB'] || null;
  // No D1 binding (or a failed query) = no providers configured:
  // fail closed, the frontend simply hides every third-party entry.
  if (!db) return json({ providers: [] });
  try {
    const providers = await getPublicMountProviders(db);
    return json({ providers });
  } catch {
    return json({ providers: [] });
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
