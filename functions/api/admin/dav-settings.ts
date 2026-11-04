// WebDAV on/off switch (cookie-session admin only).
// GET /api/admin/dav-settings -> { enabled, corrupted }
// PUT /api/admin/dav-settings { enabled } -> { enabled, corrupted }
//
// A corrupt settings object is treated as enabled=true by the DAV
// endpoint (fail-open for availability would be wrong for a switch,
// but the switch defaults to the historical DAV-on behavior and the
// corruption is reported here so the admin can repair it with PUT).

import {
  getDavSettings,
  putDavSettings,
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
  const settings = await getDavSettings(db);
  return json({ enabled: settings.enabled, corrupted: settings.corrupted });
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
  if (typeof body.enabled !== 'boolean') {
    return json({ error: 'invalid_enabled' }, 400);
  }
  await putDavSettings(db, body.enabled);
  return json({ enabled: body.enabled, corrupted: false });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'PUT') return onRequestPut(context);
  return json({ error: 'method_not_allowed' }, 405);
}
