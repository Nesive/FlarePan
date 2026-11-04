// GET /api/auth/protection -> { protected: [...] }
// PUT /api/auth/protection { protected: [...] } -> { protected: [...] }
//
// The protected-folder list the admin manages from the web UI. Stored
// in D1 (see utils/read-auth.ts). Only a cookie-session admin may read or
// write it: Basic Auth (used by DAV clients) is deliberately NOT
// accepted here, so a DAV client can never rewrite the list.
// Unauthenticated -> 401, authenticated non-admin -> 403.

import {
  getProtectionConfig,
  putProtectionConfig,
  requireAdminCookie,
  validateProtectionList,
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
  const config = await getProtectionConfig(db);
  // A corrupt config is reported (not hidden) so the admin can repair
  // it from this same endpoint; reads elsewhere fail closed meanwhile.
  return json({ protected: config.protected, corrupted: config.corrupted });
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
  const cleaned = validateProtectionList(body && body.protected);
  if (cleaned === null) {
    return json({ error: 'invalid_protection_list' }, 400);
  }
  await putProtectionConfig(db, cleaned);
  return json({ protected: cleaned, corrupted: false });
}

export async function onRequest(context) {
  // Pages Functions routes other methods here only when no specific
  // handler matches; answer explicitly instead of leaking a default.
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'PUT') return onRequestPut(context);
  return json({ error: 'method_not_allowed' }, 405);
}
