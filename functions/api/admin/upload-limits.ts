// Upload quota settings (cookie-session admin only).
// GET /api/admin/upload-limits ->
//   { max_file_mb, daily_mb, total_mb, expiry_hours }
// PUT /api/admin/upload-limits
//   { max_file_mb, daily_mb, total_mb, expiry_hours } ->
//   the stored limits.
// total_mb 0 = no total cap, expiry_hours 0 = never expire; the other
// two must be >= 1. Missing fields preserve the stored value.
import {
  getUploadLimits,
  putUploadLimits,
} from '@/utils/upload-limits';
import { requireAdminCookie } from '@/utils/read-auth';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function shape(limits) {
  return {
    max_file_mb: limits.maxFileMb,
    daily_mb: limits.dailyMb,
    total_mb: limits.totalMb,
    expiry_hours: limits.expiryHours,
  };
}

function parseField(body, name, min) {
  if (body[name] === undefined) return undefined;
  const n = parseInt(body[name], 10);
  if (!Number.isFinite(n) || n < min) return null;
  return n;
}

export async function onRequestGet(context) {
  const db = context.env['DB'] || null;
  if (!db) return json({ error: 'no_db' }, 500);
  const gate = await requireAdminCookie(context, db);
  if (gate instanceof Response) return gate;
  return json(shape(await getUploadLimits(db)));
}

export async function onRequestPut(context) {
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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'bad_request' }, 400);
  }
  const current = await getUploadLimits(db);
  const patch = {
    maxFileMb: current.maxFileMb,
    dailyMb: current.dailyMb,
    totalMb: current.totalMb,
    expiryHours: current.expiryHours,
  };
  const fields = [
    ['max_file_mb', 'maxFileMb', 1],
    ['daily_mb', 'dailyMb', 1],
    ['total_mb', 'totalMb', 0],
    ['expiry_hours', 'expiryHours', 0],
  ];
  for (const [name, key, min] of fields) {
    const value = parseField(body, name, min);
    if (value === null) return json({ error: 'invalid_' + name }, 400);
    if (value !== undefined) patch[key] = value;
  }
  await putUploadLimits(db, patch);
  return json(shape(await getUploadLimits(db)));
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'PUT') return onRequestPut(context);
  return json({ error: 'method_not_allowed' }, 405);
}
