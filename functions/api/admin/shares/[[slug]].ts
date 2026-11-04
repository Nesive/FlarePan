// Share management (cookie-session admin only).
// GET    /api/admin/shares -> { shares: [{ slug, prefix, createdBy,
//   createdAt, expiresAt, enabled }] } — never the code or its hash.
// POST   /api/admin/shares { prefix, code?, expiresIn? } -> 201
//   { slug, prefix, shareUrl, code, expiresAt, createdAt }.
//   The code is returned exactly once here; no later endpoint ever
//   returns it again. prefix must currently be protected, otherwise
//   the share is refused (an unprotected folder needs no share).
//   code: empty/missing = auto-generated 4 chars (no 0/O/1/l);
//   custom codes are 4-8 alphanumeric chars. expiresIn:
//   "permanent" | "7d" | "30d" (default "30d").
// DELETE /api/admin/shares/<slug> -> { ok: true }; the link and the
//   code die together, and outstanding grant cookies stop verifying
//   because the row is gone. Revoking also deletes the share's Sink
//   short links (recorded in share_shortlinks when they were created):
//   each recorded code is removed via Sink's delete endpoint, which
//   hard-deletes the link and leaves a tombstone, so the short link
//   dies immediately and its slug cannot be revived from cache. Sink
//   has no recycle bin, so there is nothing to restore afterwards.
//   Sink cleanup never fails the revoke itself: any code that could
//   not be deleted stays mapped and is reported in sinkFailures
//   [{ shortCode, status }] for manual cleanup in the Sink dashboard.
// POST   /api/admin/shares/<slug> { action: "regenerate", code? } ->
//   { slug, shareUrl, code }: the slug and link stay the same, the
//   old code stops working, the new code is returned exactly once.
//   Regeneration also clears any lockout.
//
// One catch-all file serves both the bare path and the per-share
// path: Pages routes /api/admin/shares here with an empty slug, so
// a sibling shares.ts + shares/[[slug]].ts pair would shadow each
// other (the catch-all answered the bare path with 405) — the same
// quirk the accounts endpoint already documents.

import {
  createShareRow,
  deleteShareRow,
  deleteShareShortlink,
  generateShareCode,
  getProtectionConfig,
  getShareRow,
  isProtectedPath,
  isValidShareCode,
  listShares,
  listShareShortlinks,
  regenerateShareCode,
  requireAdminCookie,
  resolveSinkConfig,
  sha256Hex,
  validatePrefix,
} from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function targetSlug(context) {
  const parts = context.params.slug || [];
  const raw = Array.isArray(parts) ? parts.join('/') : parts || '';
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

async function handleList(context, db) {
  const shares = await listShares(db);
  if (shares === null) return json({ error: 'share_config_corrupt' }, 500);
  return json({ shares });
}

async function handleCreate(context, db, gate) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'bad_request' }, 400);
  }
  const prefix = validatePrefix(body.prefix);
  if (prefix === null) return json({ error: 'invalid_prefix' }, 400);
  const config = await getProtectionConfig(db);
  if (config.corrupted) return json({ error: 'protection_config_corrupt' },
  500);
  if (!isProtectedPath(prefix, config.protected)) {
    return json({ error: 'not_protected' }, 400);
  }
  let code;
  if (body.code === undefined || body.code === '') {
    code = generateShareCode();
  } else {
    if (!isValidShareCode(body.code)) return json({ error: 'invalid_code' },
    400);
    code = body.code;
  }
  const expiresIn = body.expiresIn === undefined ? '30d' : body.expiresIn;
  let expiresAt = null;
  if (expiresIn === 'permanent') {
    expiresAt = null;
  } else if (expiresIn === '7d' || expiresIn === '30d') {
    const days = expiresIn === '7d' ? 7 : 30;
    expiresAt = Math.floor(Date.now() / 1000) + days * 24 * 3600;
  } else {
    return json({ error: 'invalid_expires' }, 400);
  }
  const codeHash = await sha256Hex(code);
  const slug = await createShareRow(db, {
    prefix,
    codeHash,
    createdBy: gate.user,
    expiresAt,
  });
  if (!slug) return json({ error: 'share_create_failed' }, 500);
  return json(
    {
      slug,
      prefix,
      shareUrl: `/s/${slug}`,
      code,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt,
    },
    201
  );
}

async function handleDelete(context, db, slug) {
  const row = await getShareRow(db, slug);
  if (!row) return json({ error: 'share_not_found' }, 404);
  await deleteShareRow(db, slug);
  const sinkFailures = await deleteShareShortlinks(context, db, slug);
  return json(sinkFailures.length ? { ok: true, sinkFailures } : { ok: true });
}

// Deletes every Sink short link recorded for this share. Returns the
// codes that could not be deleted (their mappings are kept, so the
// failure stays visible for a later manual cleanup). The share itself
// is already gone at this point, so this must never throw: every
// failure mode is reported, never raised.
async function deleteShareShortlinks(context, db, slug) {
  const codes = await listShareShortlinks(db, slug);
  if (codes === null) return [{ shortCode: '', status: 'mapping_read_failed' }];
  if (!codes.length) return [];
  const { base, token, usable } = await resolveSinkConfig(context, db);
  if (!usable) {
    return codes.map((shortCode) => ({ shortCode,
    status: 'sink_not_configured' }));
  }
  const failures = [];
  for (const shortCode of codes) {
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
      failures.push({ shortCode, status: 'sink_unreachable' });
      continue;
    }
    if (res.ok || res.status === 404) {
      // 404 means the code is already gone from Sink: same end state.
      await deleteShareShortlink(db, shortCode);
    } else {
      failures.push({ shortCode, status: `sink_error_${res.status}` });
    }
  }
  return failures;
}

async function handleRegenerate(context, db, slug) {
  const row = await getShareRow(db, slug);
  if (!row) return json({ error: 'share_not_found' }, 404);
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!body || body.action !== 'regenerate') {
    return json({ error: 'bad_request' }, 400);
  }
  let code;
  if (body.code === undefined || body.code === '') {
    code = generateShareCode();
  } else {
    if (!isValidShareCode(body.code)) return json({ error: 'invalid_code' },
    400);
    code = body.code;
  }
  await regenerateShareCode(db, slug, await sha256Hex(code));
  return json({ slug, shareUrl: `/s/${slug}`, code });
}

export async function onRequest(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  const slug = targetSlug(context);
  const method = context.request.method;
  if (slug === null) {
    if (method === 'GET') return handleList(context, db);
    if (method === 'POST') return handleCreate(context, db, gate);
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (method === 'DELETE') return handleDelete(context, db, slug);
  if (method === 'POST') return handleRegenerate(context, db, slug);
  return json({ error: 'method_not_allowed' }, 405);
}
