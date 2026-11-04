// Admin file actions (cookie-session only, never Basic).
// POST /api/admin/files/action
//   { action: "delete", key }
//   { action: "rename" | "move", key, target }
//   { action: "mkdir", key }   (key = folder path)
// -> { ok: true, key, target? }
//
// Source and destination both need write access (admins always have
// it). Rename/move are R2 copy + delete. Mkdir creates the existing
// folder-marker object "<folder>/_$folder$" (same convention as DAV
// MKCOL). Delete removes exactly one object, never a folder tree.

import { parseBucketPath } from '@/utils/bucket';
import {
  moveLedgerKey,
  removeLedgerRow,
} from '@/utils/upload-limits';
import {
  canWritePath,
  getPermissionsConfig,
  requireAdminCookie,
  validateUserPath,
} from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const [bucket] = parseBucketPath(context);
  if (!bucket) return json({ error: 'no_bucket' }, 500);
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
  const action = body && body.action;
  if (!['delete', 'rename', 'move', 'mkdir'].includes(action)) {
    return json({ error: 'invalid_action' }, 400);
  }
  const key = validateUserPath(body && body.key, false);
  if (key === null) {
    return json({ error: 'invalid_key' }, 400);
  }
  const permConfig = await getPermissionsConfig(db);
  const rules = permConfig.corrupted ? [] : permConfig.rules;
  if (!canWritePath(key, gate, rules)) {
    return json({ error: 'forbidden' }, 403);
  }

  if (action === 'delete') {
    if (!(await bucket.head(key))) {
      return json({ error: 'not_found' }, 404);
    }
    await bucket.delete(key);
    await removeLedgerRow(db, key);
    return json({ ok: true, key });
  }

  if (action === 'mkdir') {
    const marker = `${key}/_$folder$`;
    const existed = !!(await bucket.head(marker));
    if (!existed) {
      await bucket.put(marker, new Uint8Array(0));
    }
    return json({ ok: true, key: `${key}/`, existed });
  }

  // rename / move
  const target = validateUserPath(body && body.target, false);
  if (target === null) {
    return json({ error: 'invalid_target' }, 400);
  }
  if (target === key) {
    return json({ error: 'invalid_target' }, 400);
  }
  if (!canWritePath(target, gate, rules)) {
    return json({ error: 'forbidden' }, 403);
  }
  const src = await bucket.get(key);
  if (!src) {
    return json({ error: 'not_found' }, 404);
  }
  await bucket.put(target, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: src.customMetadata,
  });
  await bucket.delete(key);
  await moveLedgerKey(db, key, target);
  return json({ ok: true, key, target });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
