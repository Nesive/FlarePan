// Admin theme skin (cookie-session only, never Basic).
// POST /api/admin/skin, JSON body { skin } ->
//   { skin }
// The skin is a site-wide setting stored in the D1 settings table
// (key "skin"); no new migration is needed. Anything other than
// "original" or "starship" is rejected and the stored value is left
// untouched, so an illegal value can never wedge the frontend (which
// also falls back to "original" for missing or illegal values).

import { requireAdminCookie } from '@/utils/read-auth';

const VALID_SKINS = ['original', 'starship'];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
  const skin = body ? body.skin : null;
  if (!VALID_SKINS.includes(skin)) {
    return json({ error: 'invalid_skin' }, 400);
  }
  await db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) '
      + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .bind('skin', skin)
    .run();
  return json({ skin });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
