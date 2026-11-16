// Admin overview (cookie-session admin only): one call for the landing
// page — storage usage, shares, accounts, mount providers, recent shares.
// GET /api/admin/overview ->
//   { storage: { totalBytes, fileCount, totalMb, truncated },
//     shares: { count, recent: [{ slug, prefix, createdAt, enabled }] },
//     accounts: { count, adminCount },
//     mounts: { enabled: [{ id, name }] } }
// Storage is computed by listing R2 objects (paginated, capped so the
// call stays fast); folder markers (`_$folder$`) are excluded from both
// the byte total and the file count. totalMb is the admin upload cap
// (0 = no cap). If the R2 listing hits the cap, truncated=true and the
// totals are lower bounds.

import { listMountProviders } from '@/utils/read-auth';
import { getUploadLimits } from '@/utils/upload-limits';
import { requireAdminCookie } from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// R2 list page size and the maximum objects scanned per overview call.
const LIST_LIMIT = 1000;
const MAX_OBJECTS = 10000;

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;

  const bucket = context.env['BUCKET'] || null;
  let totalBytes = 0;
  let fileCount = 0;
  let truncated = false;
  if (bucket) {
    try {
      let cursor;
      let scanned = 0;
      do {
        const page = await bucket.list({ limit: LIST_LIMIT, cursor });
        for (const obj of page.objects || []) {
          if (String(obj.key || '').includes('_$folder$')) continue;
          totalBytes += Number(obj.size) || 0;
          fileCount += 1;
        }
        scanned += (page.objects || []).length;
        if (scanned >= MAX_OBJECTS) {
          truncated = page.truncated === true;
          break;
        }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    } catch {
      // R2 unavailable: report zero usage rather than failing the page.
      totalBytes = 0;
      fileCount = 0;
      truncated = false;
    }
  }

  const limits = await getUploadLimits(db);
  const sharesCountRow = await db
    .prepare('SELECT COUNT(*) AS n FROM shares')
    .first();
  const accountsCountRow = await db
    .prepare('SELECT COUNT(*) AS n FROM accounts')
    .first();
  const adminCountRow = await db
    .prepare("SELECT COUNT(*) AS n FROM accounts WHERE role = 'admin'")
    .first();
  const recentShares = await db
    .prepare(
      'SELECT slug, prefix, created_at AS createdAt, enabled FROM shares ORDER BY created_at DESC LIMIT 3'
    )
    .all();
  const providers = await listMountProviders(db);

  return json({
    storage: {
      totalBytes,
      fileCount,
      totalMb: limits.totalMb || 0,
      truncated,
    },
    shares: {
      count: Number(sharesCountRow ? sharesCountRow.n : 0) || 0,
      recent: (recentShares.results || []).map((r) => ({
        slug: r.slug,
        prefix: r.prefix,
        createdAt: r.createdAt,
        enabled: r.enabled === 1,
      })),
    },
    accounts: {
      count: Number(accountsCountRow ? accountsCountRow.n : 0) || 0,
      adminCount: Number(adminCountRow ? adminCountRow.n : 0) || 0,
    },
    mounts: {
      enabled: providers
        .filter((p) => p.enabled && p.configured)
        .map((p) => ({ id: p.id, name: p.name })),
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
