// Admin account management (cookie-session admin only, never Basic).
// GET /api/admin/accounts -> { users: [{ user, role, enabled, davEnabled }],
// corrupted }
// POST   /api/admin/accounts { user, password, role, davEnabled }
//   -> 201 { user, role, enabled, davEnabled }
// PUT    /api/admin/accounts/<user> { password?, role?, enabled?, davEnabled? }
// DELETE /api/admin/accounts/<user>
//
// One catch-all file serves both the bare path and the per-user path:
// Pages routes /api/admin/accounts here with an empty name, so a
// sibling accounts.ts + accounts/[[name]].ts pair would shadow each
// other (the catch-all answered the bare path with 405). Passwords
// are stored only as lowercase hex SHA-256 in the D1 accounts table;
// hashes are never returned by any endpoint here.
//
// Safety rules: an account cannot disable/delete itself (400
// cannot_modify_self); an edit may not remove the last enabled admin
// from the library (400 last_admin). The legacy env admin is not
// counted here: the rule guards the accounts table itself.

import {
  countEnabledAdmins,
  getAccountsConfig,
  publicAccountUser,
  putAccountsConfig,
  requireAdminCookie,
  sha256Hex,
  USERNAME_RE,
} from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function targetName(context) {
  const parts = context.params.name || [];
  const raw = parts.join('/');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

async function handleList(context, db) {
  const config = await getAccountsConfig(db);
  return json({
    users: config.users.map(publicAccountUser),
    corrupted: config.corrupted,
  });
}

async function handleCreate(context, db) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const user = body && body.user;
  const password = body && body.password;
  const role = body && body.role;
  const davEnabled = body && body.davEnabled;
  if (typeof user !== 'string' || !USERNAME_RE.test(user)) {
    return json({ error: 'invalid_user' }, 400);
  }
  if (
    typeof password !== 'string' ||
    password.length === 0 ||
    password.length > 256
  ) {
    return json({ error: 'invalid_password' }, 400);
  }
  if (role !== 'admin' && role !== 'user') {
    return json({ error: 'invalid_role' }, 400);
  }
  if (davEnabled !== undefined && typeof davEnabled !== 'boolean') {
    return json({ error: 'invalid_dav_enabled' }, 400);
  }
  const config = await getAccountsConfig(db);
  // A corrupt library is unrecoverable through the API; creating a
  // fresh row is the repair path (the env admin still works meanwhile).
  const users = config.corrupted ? [] : config.users;
  if (users.some((u) => u.user === user)) {
    return json({ error: 'user_exists' }, 409);
  }
  const row = {
    user,
    passHash: await sha256Hex(password),
    role,
    enabled: true,
    davEnabled: davEnabled === true,
  };
  users.push(row);
  await putAccountsConfig(db, users);
  return json(publicAccountUser(row), 201);
}

async function handleUpdate(context, db, name, gate) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const patch = {};
  if (body.password !== undefined) {
    if (
      typeof body.password !== 'string' ||
      body.password.length === 0 ||
      body.password.length > 256
    ) {
      return json({ error: 'invalid_password' }, 400);
    }
    patch.passHash = await sha256Hex(body.password);
  }
  if (body.role !== undefined) {
    if (body.role !== 'admin' && body.role !== 'user') {
      return json({ error: 'invalid_role' }, 400);
    }
    patch.role = body.role;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'invalid_enabled' }, 400);
    }
    patch.enabled = body.enabled;
  }
  if (body.davEnabled !== undefined) {
    if (typeof body.davEnabled !== 'boolean') {
      return json({ error: 'invalid_dav_enabled' }, 400);
    }
    patch.davEnabled = body.davEnabled;
  }
  const config = await getAccountsConfig(db);
  if (config.corrupted) {
    return json({ error: 'accounts_config_corrupt' }, 500);
  }
  const row = config.users.find((u) => u.user === name);
  if (!row) return json({ error: 'user_not_found' }, 404);
  if (name === gate.user && patch.enabled === false) {
    return json({ error: 'cannot_modify_self' }, 400);
  }
  const beforeAdmins = countEnabledAdmins(config.users);
  const next = { ...row, ...patch };
  const afterAdmins = countEnabledAdmins(
    config.users.map((u) => (u.user === name ? next : u))
  );
  if (beforeAdmins >= 1 && afterAdmins === 0) {
    return json({ error: 'last_admin' }, 400);
  }
  Object.assign(row, patch);
  await putAccountsConfig(db, config.users);
  return json(publicAccountUser(row));
}

async function handleDelete(context, db, name, gate) {
  if (name === gate.user) {
    return json({ error: 'cannot_modify_self' }, 400);
  }
  const config = await getAccountsConfig(db);
  if (config.corrupted) {
    return json({ error: 'accounts_config_corrupt' }, 500);
  }
  const idx = config.users.findIndex((u) => u.user === name);
  if (idx < 0) return json({ error: 'user_not_found' }, 404);
  const row = config.users[idx];
  const beforeAdmins = countEnabledAdmins(config.users);
  if (row.role === 'admin' && row.enabled && beforeAdmins <= 1) {
    return json({ error: 'last_admin' }, 400);
  }
  config.users.splice(idx, 1);
  await putAccountsConfig(db, config.users);
  return json({ ok: true, user: name });
}

export async function onRequest(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  const name = targetName(context);
  const method = context.request.method;
  if (name === null) {
    if (method === 'GET') return handleList(context, db);
    if (method === 'POST') return handleCreate(context, db);
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (name === '') return json({ error: 'bad_request' }, 400);
  if (method === 'PUT') return handleUpdate(context, db, name, gate);
  if (method === 'DELETE') return handleDelete(context, db, name, gate);
  return json({ error: 'method_not_allowed' }, 405);
}
