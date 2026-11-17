// Admin overview (cookie-session admin only): one call for the landing
// page — storage usage, shares, accounts, mount providers, recent shares.
// GET /api/admin/overview ->
//   { storage: { totalBytes, fileCount, totalMb, truncated },
//     shares: { count, recent: [{ slug, prefix, createdAt, enabled }] },
//     accounts: { count, adminCount },
//     mounts: { enabled: [{ id, name }] } }
// Storage is computed by listing R2 objects (paginated, capped) and
// cached in the settings table under `storage_stats`, because a full
// R2 scan takes seconds and the overview is opened on every admin visit.
// The cached value is served instantly when fresh (15 min TTL); when
// stale, the stale value is returned immediately and a background
// recompute (context.waitUntil) refreshes the cache, so the page never
// waits on the scan. First ever load (no cache) scans synchronously.
// Folder markers (`_$folder$`) are excluded from both the byte total
// and the file count. totalMb is the admin upload cap (0 = no cap).
// If the R2 listing hits the cap, truncated=true and the totals are
// lower bounds.

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

// Storage-stats cache (settings key `storage_stats`): fresh for 15 min;
// a background recompute is triggered at most once per 5 min when the
// cache is stale, so concurrent loads don't pile up duplicate scans.
const STORAGE_STATS_KEY = 'storage_stats';
const STATS_TTL_MS = 15 * 60 * 1000;
const RECOMPUTE_GUARD_MS = 5 * 60 * 1000;

async function computeStorageStats(bucket) {
  let totalBytes = 0;
  let fileCount = 0;
  let truncated = false;
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
  return { totalBytes, fileCount, truncated };
}

async function readStorageStats(db) {
  try {
    const row = await db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .bind(STORAGE_STATS_KEY)
      .first();
    if (!row || typeof row.value !== 'string') return null;
    const stats = JSON.parse(row.value);
    if (!stats || typeof stats !== 'object') return null;
    return stats;
  } catch {
    return null;
  }
}

async function writeStorageStats(db, stats) {
  try {
    await db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) '
        + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .bind(STORAGE_STATS_KEY, JSON.stringify(stats))
      .run();
  } catch {
    // Cache write failure is non-fatal; the next load recomputes.
  }
}

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;

  const bucket = context.env['BUCKET'] || null;
  const now = Date.now();
  let stats = bucket ? await readStorageStats(db) : null;
  const fresh = stats
    && typeof stats.totalBytes === 'number'
    && typeof stats.fileCount === 'number'
    && now - (stats.updatedAt || 0) < STATS_TTL_MS;
  if (bucket && !fresh) {
    const recomputing = stats
      && now - (stats.recomputeStartedAt || 0) < RECOMPUTE_GUARD_MS;
    if (!recomputing) {
      if (stats) {
        // Stale cache: return the stale value now and refresh it in
        // the background, so this load stays fast. Mark the recompute
        // as started first, so concurrent loads don't duplicate it.
        const stale = stats;
        await writeStorageStats(db, {
          totalBytes: stale.totalBytes || 0,
          fileCount: stale.fileCount || 0,
          truncated: !!stale.truncated,
          updatedAt: stale.updatedAt || 0,
          recomputeStartedAt: now,
        });
        const recompute = (async () => {
          const freshStats = await computeStorageStats(bucket);
          await writeStorageStats(db, {
            ...freshStats,
            updatedAt: Date.now(),
            recomputeStartedAt: 0,
          });
        })();
        if (typeof context.waitUntil === 'function') {
          context.waitUntil(recompute);
        } else {
          await recompute;
        }
        stats = stale;
      } else {
        // No cache at all (first load): scan synchronously once.
        const freshStats = await computeStorageStats(bucket);
        stats = {
          ...freshStats,
          updatedAt: Date.now(),
          recomputeStartedAt: 0,
        };
        await writeStorageStats(db, stats);
      }
    }
  }
  const totalBytes = stats ? (stats.totalBytes || 0) : 0;
  const fileCount = stats ? (stats.fileCount || 0) : 0;
  const truncated = stats ? !!stats.truncated : false;

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
