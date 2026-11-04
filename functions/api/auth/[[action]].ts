// Login / logout / status for read-side folder protection.
// POST /api/auth/login   { username, password } -> sets HttpOnly session cookie
// POST /api/auth/logout  -> clears the session cookie
// GET  /api/auth/status  -> { loggedIn, user, isAdmin }
//
// Accounts resolve from the R2 accounts library first (enabled rows
// only), falling back to the legacy env admin (READ_ADMIN_USER /
// READ_ADMIN_PASS_HASH). Login failure is uniform — 401 with a single
// message — and never distinguishes "no such user" from "wrong
// password". The status shape is unchanged from the single-admin phase.

import {
  authenticateLogin,
  clearSessionCookieHeader,
  createSessionValue,
  getReadIdentity,
  sessionCookieHeader,
} from '@/utils/read-auth';

function json(body, status, extraHeaders) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  }
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

export async function onRequestPost(context) {
  const action = (context.params.action || [])[0];
  if (action === 'login') {
    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    const username = body && body.username;
    const password = body && body.password;
    if (typeof username !== 'string' || typeof password !== 'string') {
      return json({ error: 'bad_request' }, 400);
    }
    const db = context.env['DB'] || null;
    const identity = await authenticateLogin(
      context.env,
      db,
      username,
      password
    );
    if (!identity) {
      return json({ error: '账号或密码错误' }, 401);
    }
    const value = await createSessionValue(context.env, identity.user);
    return json(
      { ok: true, user: identity.user, isAdmin: identity.isAdmin },
      200,
      { 'Set-Cookie': sessionCookieHeader(value, 7 * 24 * 3600) }
    );
  }
  if (action === 'logout') {
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': clearSessionCookieHeader() }
    );
  }
  return json({ error: 'not_found' }, 404);
}

export async function onRequestGet(context) {
  const action = (context.params.action || [])[0];
  if (action !== 'status') {
    return json({ error: 'not_found' }, 404);
  }
  const db = context.env['DB'] || null;
  const identity = await getReadIdentity(context, db);
  return json({
    loggedIn: !!identity,
    user: identity ? identity.user : null,
    isAdmin: identity ? !!identity.isAdmin : false,
  });
}
