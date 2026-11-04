// Admin file upload (cookie-session only, never Basic).
// POST /api/admin/files/upload, multipart form:
//   file: the file to store
//   path: target folder ("" = bucket root)
// -> { key, size }
//
// The caller needs write access to the destination key (admins always
// have it). Folder markers follow the existing convention: an empty
// object at "<folder>/_$folder$".

import { parseBucketPath } from '@/utils/bucket';
import {
  checkUpload,
  recordUpload,
  sweepExpired,
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
  let form;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const file = form.get('file');
  const rawPath = form.get('path');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.name) {
    return json({ error: 'missing_file' }, 400);
  }
  const folder =
    rawPath === null || rawPath === undefined
      ? ''
      : validateUserPath(String(rawPath), true);
  if (folder === null) {
    return json({ error: 'invalid_path' }, 400);
  }
  const name = file.name;
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\')
  ) {
    return json({ error: 'invalid_filename' }, 400);
  }
  const key = folder ? `${folder}/${name}` : name;
  if (key.startsWith('_$flaredrive$/')) {
    return json({ error: 'invalid_path' }, 400);
  }
  const permConfig = await getPermissionsConfig(db);
  const rules = permConfig.corrupted ? [] : permConfig.rules;
  if (!canWritePath(key, gate, rules)) {
    return json({ error: 'forbidden' }, 403);
  }
  const data = await file.arrayBuffer();
  const identity = 'admin:' + (gate.user || 'unknown');
  const denied = await checkUpload(
    db, key, data.byteLength, identity, Date.now());
  if (denied) {
    return json({ error: denied.code }, denied.status);
  }
  await bucket.put(key, data, {
    httpMetadata: file.type ? { contentType: file.type } : undefined,
  });
  await recordUpload(db, key, data.byteLength, identity, Date.now());
  await sweepExpired(db, bucket, Date.now(), 50);
  return json({ key, size: data.byteLength });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
