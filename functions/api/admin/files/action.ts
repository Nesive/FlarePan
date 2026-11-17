// Admin file actions (cookie-session only, never Basic).
// POST /api/admin/files/action
//   { action: "delete", key }
//   { action: "rename" | "move", key, target }
//   { action: "mkdir", key }   (key = folder path)
//   { action: "rename-folder", key, target }  (same-parent folder rename)
//   { action: "delete-folder", key [, preview: true] }  (recursive
//     folder delete; preview counts objects and affected D1 rows
//     without deleting anything)
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
import { hasFolderMarkerSegment } from '@/utils/folder-marker';
import {
  moveLedgerKey,
  moveLedgerPrefix,
  removeLedgerRow,
  removeLedgerRows,
} from '@/utils/upload-limits';
import {
  canWritePath,
  deleteShareShortlink,
  getPermissionsConfig,
  listShareShortlinks,
  requireAdminCookie,
  resolveSinkConfig,
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

// ---- delete-folder helpers ----

// A D1 prefix row belongs to a folder when it is the folder itself
// or under it. Prefixes are stored with a trailing "/" (see
// validatePrefix); a row stored bare (no slash) still matches on
// exact equality. Same matching as renamePrefixRows above.
function prefixUnder(prefix, folderPrefix, folderKey) {
  return prefix === folderPrefix || prefix === folderKey
    || (typeof prefix === 'string' && prefix.startsWith(folderPrefix));
}

// Shares, permission rules and protected prefixes that point at (or
// under) a folder. Used both by the delete-folder preview (counts)
// and by the delete itself (which rows to remove).
async function findAffectedPrefixRows(db, folderKey, folderPrefix) {
  const shares = await db
    .prepare('SELECT slug, prefix FROM shares').all();
  const shareSlugs = [];
  for (const row of shares.results || []) {
    if (prefixUnder(row.prefix, folderPrefix, folderKey)) {
      shareSlugs.push(row.slug);
    }
  }
  const rules = await db
    .prepare('SELECT user, prefix FROM permission_rules').all();
  const permissionRows = [];
  for (const row of rules.results || []) {
    if (prefixUnder(row.prefix, folderPrefix, folderKey)) {
      permissionRows.push({ user: row.user, prefix: row.prefix });
    }
  }
  const prot = await db
    .prepare('SELECT prefix FROM protected_prefixes').all();
  const protectedPrefixes = [];
  for (const row of prot.results || []) {
    if (prefixUnder(row.prefix, folderPrefix, folderKey)) {
      protectedPrefixes.push(row.prefix);
    }
  }
  return { shareSlugs, permissionRows, protectedPrefixes };
}

// Count objects under a prefix, stopping after LIMIT so a huge
// folder stays cheap to preview. Returns the count (capped at
// LIMIT) and whether more objects exist beyond it.
const DELETE_FOLDER_PREVIEW_LIMIT = 1000;

async function countPrefixObjects(bucket, prefix) {
  let count = 0;
  let cursor;
  do {
    const page = await bucket.list({
      prefix,
      cursor,
      limit: Math.min(1000, DELETE_FOLDER_PREVIEW_LIMIT + 1 - count),
    });
    count += page.objects.length;
    if (count > DELETE_FOLDER_PREVIEW_LIMIT) {
      return { count: DELETE_FOLDER_PREVIEW_LIMIT, truncated: true };
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { count, truncated: false };
}

// Revoke one Sink short link. Returns { ok: true } when Sink confirms
// (or 404s: the code is already gone, same end state), otherwise
// { ok: false, status }. Mirrors the same function in
// functions/api/admin/shares/[[slug]].ts.
async function deleteOneSinkShortlink(context, db, shortCode) {
  const { base, token, usable } = await resolveSinkConfig(context, db);
  if (!usable) return { ok: false, status: 'sink_not_configured' };
  let res = null;
  try {
    res = await fetch(`${base}/api/link/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // Same bot-mitigation note as shorten.ts: the Sink zone drops
        // non-browser clients on API paths.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ slug: shortCode }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, status: 'sink_unreachable' };
  }
  if (res.ok || res.status === 404) return { ok: true, status: '' };
  return { ok: false, status: `sink_error_${res.status}` };
}

// Revoke every Sink short link recorded for the given share slugs.
// Best-effort and never throws: failures are reported, never raised
// (mirrors deleteShareShortlinks in [[slug]].ts).
async function deleteSinkShortlinksForSlugs(context, db, slugs) {
  const failures = [];
  for (const slug of slugs) {
    let codes;
    try {
      codes = await listShareShortlinks(db, slug);
    } catch {
      failures.push({ slug, status: 'mapping_read_failed' });
      continue;
    }
    if (codes === null) {
      failures.push({ slug, status: 'mapping_read_failed' });
      continue;
    }
    for (const shortCode of codes) {
      const r = await deleteOneSinkShortlink(context, db, shortCode);
      if (r.ok) {
        await deleteShareShortlink(db, shortCode);
      } else {
        failures.push({ shortCode, status: r.status });
      }
    }
  }
  return failures;
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
  if (!['delete', 'rename', 'move', 'mkdir', 'rename-folder',
    'delete-folder'].includes(action)) {
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

  // delete-folder: recursive folder delete. key is a folder path (no
  // trailing slash after validateUserPath). Removes the folder and
  // EVERYTHING under it: all R2 objects, the D1 rows that point at
  // or under it (shares, permission rules, protected prefixes), and
  // the upload ledger rows. Shares under it also get their Sink
  // short links revoked (best-effort, reported in sinkFailures).
  // A folder that is itself a protected prefix is refused (403
  // protected_folder): remove it from the protected list first, so
  // a whole protected content folder cannot be wiped by one click.
  // preview: true counts objects and affected D1 rows and deletes
  // nothing, so the UI can confirm with real numbers.
  if (action === 'delete-folder') {
    if (hasFolderMarkerSegment(key)) {
      return json({ error: 'invalid_key' }, 400);
    }
    const folderPrefix = `${key}/`;
    const folderKey = key;
    const protRows = await db
      .prepare('SELECT prefix FROM protected_prefixes').all();
    for (const row of protRows.results || []) {
      if (row.prefix === folderPrefix) {
        return json({ error: 'protected_folder' }, 403);
      }
    }
    if (body && body.preview === true) {
      const { count, truncated } = await countPrefixObjects(
        bucket, folderPrefix);
      const affected = await findAffectedPrefixRows(
        db, folderKey, folderPrefix);
      return json({
        ok: true,
        key,
        preview: true,
        count,
        truncated,
        shares: affected.shareSlugs.length,
        permissions: affected.permissionRows.length,
        protected: affected.protectedPrefixes.length,
      });
    }
    const objects = await listAll(bucket, folderPrefix);
    if (!objects.length) {
      return json({ error: 'not_found' }, 404);
    }
    let deleted = 0;
    for (const obj of objects) {
      try {
        await bucket.delete(obj.key);
      } catch {
        return json({ error: 'delete_failed', deleted }, 500);
      }
      deleted += 1;
    }
    const keys = objects.map((o) => o.key);
    const affected = await findAffectedPrefixRows(
      db, folderKey, folderPrefix);
    const sinkFailures = await deleteSinkShortlinksForSlugs(
      context, db, affected.shareSlugs);
    try {
      const stmts = [];
      for (const slug of affected.shareSlugs) {
        stmts.push(
          db.prepare('DELETE FROM shares WHERE slug = ?').bind(slug));
      }
      for (const row of affected.permissionRows) {
        stmts.push(
          db.prepare('DELETE FROM permission_rules '
            + 'WHERE user = ? AND prefix = ?')
            .bind(row.user, row.prefix));
      }
      for (const prefix of affected.protectedPrefixes) {
        stmts.push(
          db.prepare('DELETE FROM protected_prefixes WHERE prefix = ?')
            .bind(prefix));
      }
      if (stmts.length) await db.batch(stmts);
      await removeLedgerRows(db, keys);
    } catch {
      return json({ error: 'db_update_failed', deleted }, 500);
    }
    const out = {
      ok: true,
      key,
      deleted,
      sharesDeleted: affected.shareSlugs.length,
    };
    if (sinkFailures.length) out.sinkFailures = sinkFailures;
    return json(out);
  }

  if (action === 'mkdir') {
    // "_$folder$" is reserved: a folder may not be created under
    // (or as) a marker path. The marker itself is written below.
    if (hasFolderMarkerSegment(key)) {
      return json({ error: 'invalid_key' }, 400);
    }
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
    if (hasFolderMarkerSegment(key)
      || hasFolderMarkerSegment(target)) {
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
  // "_$folder$" is reserved in file names and target paths.
  if (hasFolderMarkerSegment(key)
    || hasFolderMarkerSegment(target)) {
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
