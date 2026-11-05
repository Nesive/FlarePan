// Upload quotas + expiry (see migrations/0005_upload_quotas.sql).
//
// Every gated upload route checks before writing and records after
// writing; deletes and renames keep the ledger in step. Quotas are
// approximate guards, not financial accounting: concurrent uploads can
// overshoot slightly, and the ledger only counts files uploaded after
// the migration (older files are fail-open for totals).
//
// Limits live in the settings table (admin upload-limits tab):
//   upload_max_file_mb  per-file cap (must be >= 1)
//   upload_daily_mb     per-identity per-UTC-day cap (must be >= 1)
//   upload_total_mb     total storage cap (0 = unlimited)
//   upload_expiry_hours auto-expiry for new uploads (0 = never)
// A deployment without D1 skips all checks (old behavior).

import { sha256Hex } from '@/utils/read-auth';

const MB = 1024 * 1024;

// Production defaults: generous per-file and daily caps, no total cap
// (an upgrade must never lock out an existing library), no expiry.
// A demo deployment sets stricter values (see README).
export const UPLOAD_LIMIT_DEFAULTS = {
  maxFileMb: 500,
  dailyMb: 2048,
  totalMb: 0,
  expiryHours: 0,
};

function parseLimit(value, fallback, min) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

export async function getUploadLimits(db) {
  const limits = { ...UPLOAD_LIMIT_DEFAULTS };
  if (!db) return limits;
  try {
    const res = await db
      .prepare(
        'SELECT key, value FROM settings WHERE key IN ('
        + "'upload_max_file_mb', 'upload_daily_mb', "
        + "'upload_total_mb', 'upload_expiry_hours')"
      )
      .all();
    if (!res.success) return limits;
    for (const row of res.results || []) {
      if (row.key === 'upload_max_file_mb') {
        limits.maxFileMb = parseLimit(row.value, limits.maxFileMb, 1);
      } else if (row.key === 'upload_daily_mb') {
        limits.dailyMb = parseLimit(row.value, limits.dailyMb, 1);
      } else if (row.key === 'upload_total_mb') {
        limits.totalMb = parseLimit(row.value, limits.totalMb, 0);
      } else if (row.key === 'upload_expiry_hours') {
        limits.expiryHours = parseLimit(row.value, limits.expiryHours, 0);
      }
    }
  } catch {
    // Fall through with defaults.
  }
  return limits;
}

export async function putUploadLimits(db, limits) {
  if (!db) throw new Error('no_db');
  const stmts = [
    ['upload_max_file_mb', limits.maxFileMb],
    ['upload_daily_mb', limits.dailyMb],
    ['upload_total_mb', limits.totalMb],
    ['upload_expiry_hours', limits.expiryHours],
  ].map(([key, value]) =>
    db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) '
        + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .bind(key, String(value))
  );
  await db.batch(stmts);
}

export function dayStartMs(now) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

// Identities are hashed where they derive from secrets (Basic account
// strings) or network identifiers (IPs); usernames are stored as-is
// because the admin already sees them.
export async function requestIdentity(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Basic ')) {
    const decoded = atob(auth.slice('Basic '.length).trim());
    const hash = await sha256Hex(decoded);
    return 'basic:' + hash.slice(0, 16);
  }
  const ip = request.headers.get('CF-Connecting-IP')
    || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim()
    || 'unknown';
  const hash = await sha256Hex(ip);
  return 'ip:' + hash.slice(0, 16);
}

// Returns null when the upload fits, otherwise { code, status }.
// The total check nets out an existing object at the same key (an
// overwrite frees its old bytes); the daily check counts the full new
// size (rewriting the same file still burns writes).
export async function checkUpload(db, key, size, identity, now) {
  if (!db) return null;
  const limits = await getUploadLimits(db);
  if (size > limits.maxFileMb * MB) {
    return { code: 'upload_too_large', status: 413 };
  }
  const dayStart = dayStartMs(now);
  const ledgerDay = await db
    .prepare(
      'SELECT COALESCE(SUM(size), 0) AS total FROM upload_ledger '
      + 'WHERE identity = ? AND uploaded_at >= ?'
    )
    .bind(identity, dayStart)
    .first();
  const reservedDay = await db
    .prepare(
      'SELECT COALESCE(SUM(size), 0) AS total FROM upload_reservations '
      + 'WHERE identity = ? AND created_at >= ?'
    )
    .bind(identity, dayStart)
    .first();
  const dayTotal = (ledgerDay ? ledgerDay.total : 0)
    + (reservedDay ? reservedDay.total : 0);
  if (dayTotal + size > limits.dailyMb * MB) {
    return { code: 'daily_quota_exceeded', status: 429 };
  }
  if (limits.totalMb > 0) {
    const totalRow = await db
      .prepare('SELECT COALESCE(SUM(size), 0) AS total FROM upload_ledger')
      .first();
    const existing = await db
      .prepare('SELECT size FROM upload_ledger WHERE key = ?')
      .bind(key)
      .first();
    const total = (totalRow ? totalRow.total : 0)
      - (existing ? existing.size : 0);
    if (total + size > limits.totalMb * MB) {
      return { code: 'storage_quota_exceeded', status: 507 };
    }
  }
  return null;
}

export async function recordUpload(db, key, size, identity, now) {
  if (!db) return;
  const limits = await getUploadLimits(db);
  const expiresAt = limits.expiryHours > 0
    ? now + limits.expiryHours * 3600 * 1000
    : null;
  await db
    .prepare(
      'INSERT INTO upload_ledger (key, size, identity, uploaded_at, expires_at) '
      + 'VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET '
      + 'size = excluded.size, identity = excluded.identity, '
      + 'uploaded_at = excluded.uploaded_at, expires_at = excluded.expires_at'
    )
    .bind(key, size, identity, now, expiresAt)
    .run();
}

export async function removeLedgerRow(db, key) {
  if (!db) return;
  await db.prepare('DELETE FROM upload_ledger WHERE key = ?').bind(key).run();
}

export async function removeLedgerRows(db, keys) {
  if (!db || !keys.length) return;
  const stmts = keys.map((key) =>
    db.prepare('DELETE FROM upload_ledger WHERE key = ?').bind(key)
  );
  await db.batch(stmts);
}

// Rename/move: the destination row (if any) is replaced, the source row
// keeps its size, identity and upload time under the new key.
export async function moveLedgerKey(db, oldKey, newKey) {
  if (!db) return;
  await db.batch([
    db.prepare('DELETE FROM upload_ledger WHERE key = ?').bind(newKey),
    db.prepare('UPDATE upload_ledger SET key = ? WHERE key = ?')
      .bind(newKey, oldKey),
  ]);
}

// Folder rename: rewrite every ledger key under oldPrefix to newPrefix.
// Prefixes end with "/". The range scan (key >= prefix AND key <
// prefix-with-last-char-bumped) avoids LIKE wildcards in folder names.
// Destination-range rows are deleted first so the UPDATE can never hit
// a PRIMARY KEY collision on a stale row.
export async function moveLedgerPrefix(db, oldPrefix, newPrefix) {
  if (!db) return;
  const upper = (prefix) => prefix.slice(0, -1) + '0';
  await db.batch([
    db.prepare('DELETE FROM upload_ledger WHERE key >= ? AND key < ?')
      .bind(newPrefix, upper(newPrefix)),
    db.prepare(
      'UPDATE upload_ledger SET key = ? || substr(key, ?) '
      + 'WHERE key >= ? AND key < ?'
    ).bind(newPrefix, oldPrefix.length + 1, oldPrefix, upper(oldPrefix)),
  ]);
}

export async function reserveMultipart(db, uploadId, key, identity, size, now) {
  if (!db) return;
  await db
    .prepare(
      'INSERT INTO upload_reservations '
      + '(upload_id, key, identity, size, created_at) VALUES (?, ?, ?, ?, ?) '
      + 'ON CONFLICT(upload_id) DO UPDATE SET key = excluded.key, '
      + 'identity = excluded.identity, size = excluded.size, '
      + 'created_at = excluded.created_at'
    )
    .bind(uploadId, key, identity, size, now)
    .run();
}

// Takes (and deletes) the reservation; returns it or null.
export async function takeReservation(db, uploadId) {
  if (!db) return null;
  const row = await db
    .prepare('SELECT * FROM upload_reservations WHERE upload_id = ?')
    .bind(uploadId)
    .first();
  if (row) {
    await db
      .prepare('DELETE FROM upload_reservations WHERE upload_id = ?')
      .bind(uploadId)
      .run();
  }
  return row || null;
}

// Deletes expired ledger files (R2 object + row) and stale reservations
// (older than 48h). Runs piggyback on uploads: no cron binding is
// needed, and the total cap still bounds storage even if cleanup lags.
// Returns the number of expired files removed.
export async function sweepExpired(db, bucket, now, limit) {
  if (!db) return 0;
  let swept = 0;
  try {
    const res = await db
      .prepare(
        'SELECT key FROM upload_ledger WHERE expires_at IS NOT NULL '
        + 'AND expires_at <= ? LIMIT ?'
      )
      .bind(now, limit || 50)
      .all();
    const keys = (res.results || []).map((row) => row.key);
    for (const key of keys) {
      try {
        if (bucket) await bucket.delete(key);
      } catch {
        // Keep going: the row is still removed below so a missing
        // object does not wedge the sweep.
      }
      await removeLedgerRow(db, key);
      swept += 1;
    }
    await db
      .prepare('DELETE FROM upload_reservations WHERE created_at < ?')
      .bind(now - 48 * 3600 * 1000)
      .run();
  } catch {
    // A failed sweep must never fail the upload that triggered it.
  }
  return swept;
}
