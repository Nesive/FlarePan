// Admin file actions (cookie-session only, never Basic).
// POST /api/admin/files/action
//   { action: "delete", key }
//   { action: "rename" | "move", key, target }
//   { action: "mkdir", key }   (key = folder path)
//   { action: "rename-folder", key, target }  (same-parent folder rename)
// -> { ok: true, key, target? }
//
// Source and destination both need write access (admins always have
// it). Rename/move are R2 copy + delete. Mkdir creates the existing
// folder-marker object "<folder>/_$folder$" (same convention as DAV
// MKCOL). Delete removes exactly one object, never a folder tree.
// Rename-folder copies every object under "<key>/" to "<target>/"
// (same parent only), then deletes the old objects and rewrites the
// D1 prefix rows that point at the folder. A copy that fails midway
// stops with 500 and the count already copied; copied objects are
// NOT rolled back, and the old folder is left as-is for the failed
// part (the response says how many were copied).

import { parseBucketPath } from '@/utils/bucket';
import {
  moveLedgerKey,
  moveLedgerPrefix,
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

function parentDir(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

async function listAll(bucket, prefix) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

// Rewrite D1 prefix rows that point at (or under) a renamed folder.
// Prefixes are stored with a trailing "/" (see validatePrefix); a row
// stored bare (no slash) still matches on exact equality. The
// trailing slash on oldPrefix keeps sibling prefixes (e.g. "docs2/"
// when renaming "docs/") out of the match.
async function renamePrefixRows(db, oldPrefix, newPrefix) {
  const oldKey = oldPrefix.slice(0, -1);
  const newKey = newPrefix.slice(0, -1);
  const remap = (prefix) => {
    if (prefix === oldPrefix) return newPrefix;
    if (prefix === oldKey) return newKey;
    if (prefix.startsWith(oldPrefix)) {
      return newPrefix + prefix.slice(oldPrefix.length);
    }
    return null;
  };
  const stmts = [];
  const shares = await db
    .prepare('SELECT slug, prefix FROM shares').all();
  for (const row of shares.results || []) {
    const next = remap(row.prefix);
    if (next !== null) {
      stmts.push(
        db.prepare('UPDATE shares SET prefix = ? WHERE slug = ?')
          .bind(next, row.slug)
      );
    }
  }
  const rules = await db
    .prepare('SELECT user, prefix FROM permission_rules').all();
  for (const row of rules.results || []) {
    const next = remap(row.prefix);
    if (next !== null) {
      stmts.push(
        db.prepare('UPDATE permission_rules SET prefix = ? '
          + 'WHERE user = ? AND prefix = ?')
          .bind(next, row.user, row.prefix)
      );
    }
  }
  const prot = await db
    .prepare('SELECT prefix FROM protected_prefixes').all();
  for (const row of prot.results || []) {
    const next = remap(row.prefix);
    if (next !== null) {
      stmts.push(
        db.prepare('DELETE FROM protected_prefixes WHERE prefix = ?')
          .bind(row.prefix)
      );
      stmts.push(
        db.prepare('INSERT INTO protected_prefixes (prefix) VALUES (?)')
          .bind(next)
      );
    }
  }
  if (stmts.length) await db.batch(stmts);
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
  if (!['delete', 'rename', 'move', 'mkdir', 'rename-folder']
    .includes(action)) {
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

  // rename-folder: same-parent folder rename. key/target are folder
  // paths (no trailing slash after validateUserPath).
  if (action === 'rename-folder') {
    const target = validateUserPath(body && body.target, false);
    if (target === null || target === key
      || parentDir(target) !== parentDir(key)) {
      return json({ error: 'invalid_target' }, 400);
    }
    if (!canWritePath(target, gate, rules)) {
      return json({ error: 'forbidden' }, 403);
    }
    const oldPrefix = `${key}/`;
    const newPrefix = `${target}/`;
    const srcPage = await bucket.list({ prefix: oldPrefix, limit: 1 });
    if (!srcPage.objects.length) {
      return json({ error: 'not_found' }, 404);
    }
    const dstPage = await bucket.list({ prefix: newPrefix, limit: 1 });
    if (dstPage.objects.length) {
      return json({ error: 'target_exists' }, 409);
    }
    const objects = await listAll(bucket, oldPrefix);
    let copied = 0;
    for (const obj of objects) {
      const rest = obj.key.slice(oldPrefix.length);
      const srcObj = await bucket.get(obj.key);
      if (!srcObj) {
        return json({ error: 'rename_failed', copied }, 500);
      }
      try {
        await bucket.put(newPrefix + rest, srcObj.body, {
          httpMetadata: srcObj.httpMetadata,
          customMetadata: srcObj.customMetadata,
        });
      } catch {
        return json({ error: 'rename_failed', copied }, 500);
      }
      copied += 1;
    }
    let deleted = 0;
    for (const obj of objects) {
      try {
        await bucket.delete(obj.key);
      } catch {
        return json({ error: 'delete_failed', copied, deleted }, 500);
      }
      deleted += 1;
    }
    try {
      await renamePrefixRows(db, oldPrefix, newPrefix);
      await moveLedgerPrefix(db, oldPrefix, newPrefix);
    } catch {
      return json({ error: 'db_update_failed', copied }, 500);
    }
    return json({ ok: true, key, target, moved: copied });
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
