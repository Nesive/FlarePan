// Permission-rule management (cookie-session admin only).
// GET    /api/admin/permissions -> { rules, corrupted }
// POST   /api/admin/permissions { user, prefix, access } (upsert)
// DELETE /api/admin/permissions { user, prefix }
//
// Prefix rules match the protected-list rules (normalized, trailing
// slash, no _$flaredrive$/ prefix, no "." / ".." segments). Access is
// read | write | none. Longest-prefix matching is done by
// utils/read-auth.ts at read/write time.

import {
  getPermissionsConfig,
  putPermissionsConfig,
  requireAdminCookie,
  USERNAME_RE,
  validatePrefix,
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
  const config = await getPermissionsConfig(db);
  return json({ rules: config.rules, corrupted: config.corrupted });
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
  if (typeof body.user !== 'string' || !USERNAME_RE.test(body.user)) {
    return json({ error: 'invalid_user' }, 400);
  }
  const prefix = validatePrefix(body.prefix);
  if (prefix === null) {
    return json({ error: 'invalid_prefix' }, 400);
  }
  if (
    body.access !== 'read' &&
    body.access !== 'write' &&
    body.access !== 'none'
  ) {
    return json({ error: 'invalid_access' }, 400);
  }
  const config = await getPermissionsConfig(db);
  // A corrupt rules file is repaired by overwriting it with the
  // cleaned rules (same repair shape as the protection endpoint).
  const rules = config.corrupted ? [] : config.rules;
  const rule = { user: body.user, prefix, access: body.access };
  const idx = rules.findIndex(
    (r) => r.user === rule.user && r.prefix === rule.prefix
  );
  if (idx >= 0) rules[idx] = rule;
  else rules.push(rule);
  await putPermissionsConfig(db, rules);
  return json({ ok: true, rule });
}

export async function onRequestDelete(context) {
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
  if (typeof body.user !== 'string' || !USERNAME_RE.test(body.user)) {
    return json({ error: 'invalid_user' }, 400);
  }
  const prefix = validatePrefix(body.prefix);
  if (prefix === null) {
    return json({ error: 'invalid_prefix' }, 400);
  }
  const config = await getPermissionsConfig(db);
  if (config.corrupted) {
    return json({ error: 'permissions_config_corrupt' }, 500);
  }
  const idx = config.rules.findIndex(
    (r) => r.user === body.user && r.prefix === prefix
  );
  if (idx < 0) return json({ error: 'rule_not_found' }, 404);
  config.rules.splice(idx, 1);
  await putPermissionsConfig(db, config.rules);
  return json({ ok: true, user: body.user, prefix });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'DELETE') return onRequestDelete(context);
  return json({ error: 'method_not_allowed' }, 405);
}
