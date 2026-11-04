// Admin upload cleanup (cookie-session only, never Basic).
// POST /api/admin/files/cleanup, JSON body:
//   key: the R2 key to clean residue for
//   existedBefore: whether an object already existed at that key
//     before the failed upload attempt (taken from the upload response)
// -> { deletedObject, deletedReservations, deletedLedger, reason }
//
// Safety rule: only residue from this attempt is removed. When the
// upload target already existed, or a ledger row exists for the key,
// the object and the ledger row are left untouched and the reason is
// reported instead (reason is null when nothing had to be kept).

import { parseBucketPath } from '@/utils/bucket';
import { requireAdminCookie } from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validKey(key) {
  if (typeof key !== 'string' || !key) return false;
  if (key.startsWith('/') || key.includes('\\')) return false;
  if (key.startsWith('_$flaredrive$/')) return false;
  const parts = key.split('/');
  return !parts.some((part) => part === '' || part === '.' || part === '..');
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
  const key = body ? body.key : null;
  const existedBefore = body ? body.existedBefore : null;
  if (!validKey(key) || typeof existedBefore !== 'boolean') {
    return json({ error: 'bad_request' }, 400);
  }
  // Multipart reservations for this key: abandoned uploads count
  // against the daily quota until swept (at most 48h), so a failed
  // admin upload clears them right away to unblock a retry.
  let deletedReservations = 0;
  try {
    const res = await db
      .prepare('DELETE FROM upload_reservations WHERE key = ?')
      .bind(key)
      .run();
    deletedReservations = res && res.meta
      ? Number(res.meta.changes) || 0
      : 0;
  } catch {
    // Reservation cleanup is best effort; object handling below
    // still runs.
  }
  const ledgerRow = await db
    .prepare('SELECT key FROM upload_ledger WHERE key = ?')
    .bind(key)
    .first();
  const hasLedger = !!ledgerRow;
  let deletedObject = false;
  let reason = null;
  if (hasLedger) {
    // A ledger row means the key is accounted for: never delete the
    // object or the row.
    reason = 'has_ledger';
  } else if (existedBefore) {
    // The file predates this upload attempt: leave it alone.
    reason = 'existed_before';
  } else {
    // Only an orphan object from this attempt may be removed.
    let head = null;
    try {
      head = await bucket.head(key);
    } catch {
      head = null;
    }
    if (head) {
      try {
        await bucket.delete(key);
        deletedObject = true;
      } catch {
        deletedObject = false;
      }
    }
  }
  return json({
    deletedObject,
    deletedReservations,
    deletedLedger: false,
    reason,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
