// WebDAV endpoint mounted at /dav/*, backed by the same R2 binding
// as the web UI. No LOCK support: LOCK/UNLOCK answer 405 explicitly
// rather than pretending to lock (a fake lock would let clients
// overwrite each other while believing they are safe).
//
// Authentication reuses the read-side account table:
//   - Reads (PROPFIND/GET/HEAD) on public paths are anonymous; protected
//     paths need a caller authenticated for their prefix.
//   - Writes (PUT/DELETE/MKCOL/MOVE/COPY) always need an authenticated
//     caller with access to the affected prefix. There are no anonymous
//     DAV writes, even on public paths.
//   - WebDAV clients authenticate with HTTP Basic Auth; the web UI uses
//     the same table via session cookies (see utils/read-auth.ts).
// The internal _$flaredrive$/ prefix is never exposed here.

import { notFound, parseBucketPath } from '@/utils/bucket';
import {
  checkUpload,
  moveLedgerKey,
  recordUpload,
  removeLedgerRow,
  removeLedgerRows,
  sweepExpired,
} from '@/utils/upload-limits';
import { serveR2Object } from '@/utils/r2serve';
import {
  authRequiredResponse,
  canReadPath,
  canWritePath,
  configCorruptResponse,
  forbiddenResponse,
  getDavSettings,
  getPermissionsConfig,
  getProtectionConfig,
  getReadIdentity,
  isDavDisabledIdentity,
  isProtectedPath,
} from '@/utils/read-auth';

const DAV_HEADERS = {
  DAV: '1, 2',
  'MS-Author-Via': 'DAV',
};
const ALLOW =
  'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND';

function xmlEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function encodeSegments(segments) {
  return segments.map((s) => encodeURIComponent(s)).join('/');
}

// Decodes the DAV path from the request URL.
function davPathSegments(context) {
  const pathname = new URL(context.request.url).pathname;
  const raw = pathname.replace(/^\/dav\/?/, '');
  if (!raw) return [];
  const parts = raw.split('/').filter((s) => s !== '');
  const decoded = [];
  for (const part of parts) {
    try {
      decoded.push(decodeURIComponent(part));
    } catch {
      return null;
    }
  }
  return decoded;
}

async function listAll(bucket, prefix) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({
      prefix,
      cursor,
      include: ['httpMetadata', 'customMetadata'],
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

async function listDir(bucket, prefix) {
  // Direct children only (files + immediate subfolders).
  const objects = [];
  const folders = [];
  let cursor;
  do {
    const page = await bucket.list({
      prefix,
      delimiter: '/',
      cursor,
      include: ['httpMetadata', 'customMetadata'],
    });
    objects.push(...page.objects);
    folders.push(...page.delimitedPrefixes);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { objects, folders };
}

async function folderExists(bucket, path) {
  if (!path) return true; // root always exists
  if (await bucket.head(`${path}/_$folder$`)) return true;
  const page = await bucket.list({ prefix: `${path}/`, limit: 1 });
  return page.objects.length > 0;
}

async function resourceKind(bucket, path) {
  // "file" | "collection" | null
  if (!path) return 'collection';
  if (await bucket.head(path)) return 'file';
  if (await folderExists(bucket, path)) return 'collection';
  return null;
}

function propXml(href, displayName, kind, file) {
  let props = `<D:displayname>${xmlEscape(displayName)}</D:displayname>`;
  if (kind === 'collection') {
    props += '<D:resourcetype><D:collection/></D:resourcetype>';
  } else {
    props += '<D:resourcetype/>';
    if (file) {
      props += `<D:getcontentlength>${file.size}</D:getcontentlength>`;
      if (file.httpMetadata && file.httpMetadata.contentType) {
        props += `<D:getcontenttype>${xmlEscape(
          file.httpMetadata.contentType
        )}</D:getcontenttype>`;
      }
      if (file.httpEtag) props += `<D:getetag>${xmlEscape(file.httpEtag)}</D:getetag>`;
      if (file.uploaded) {
        props += `<D:getlastmodified>${file.uploaded.toUTCString()}</D:getlastmodified>`;
      }
    }
  }
  return (
    `<D:response><D:href>${xmlEscape(href)}</D:href>` +
    `<D:propstat><D:prop>${props}</D:prop>` +
    `<D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`
  );
}

function multistatus(responses) {
  return new Response(
    `<?xml version="1.0" encoding="utf-8" ?>` +
      `<D:multistatus xmlns:D="DAV:">${responses.join('')}</D:multistatus>`,
    {
      status: 207,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        DAV: '1, 2',
      },
    }
  );
}

function methodNotAllowed() {
  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: ALLOW },
  });
}

async function handlePropfind(context,
bucket,
path,
segments,
identity,
protectedList,
rules) {
  const depthHeader = context.request.headers.get('Depth');
  let depth = 1;
  if (depthHeader === '0') depth = 0;
  else if (depthHeader === '1' || depthHeader === null) depth = 1;
  else if (depthHeader === 'infinity') {
    return new Response('Depth: infinity is not supported', { status: 403 });
  } else {
    return new Response('Invalid Depth header', { status: 400 });
  }

  const kind = await resourceKind(bucket, path);
  if (!kind) return notFound();

  const baseHref = segments.length ? `/dav/${encodeSegments(segments)}` : '/dav';
  const selfHref = kind === 'collection' ? `${baseHref}/` : baseHref;
  const displayName = segments.length
    ? segments[segments.length - 1]
    : '';
  const responses = [];
  if (kind === 'file') {
    const file = await bucket.head(path);
    responses.push(propXml(selfHref, displayName, 'file', file));
    return multistatus(responses);
  }

  // Collection self.
  responses.push(propXml(selfHref, displayName, 'collection', null));
  if (depth === 1) {
    const prefix = path ? `${path}/` : '';
    const { objects, folders } = await listDir(bucket, prefix);
    for (const obj of objects) {
      if (obj.key.endsWith('/_$folder$')) continue;
      if (obj.key.startsWith('_$flaredrive$/')) continue;
      // Same caliber-B filtering as the web listing: protected entries
      // are hidden from callers without access to them.
      if (
        isProtectedPath(obj.key, protectedList) &&
        !canReadPath(obj.key, identity, protectedList, rules)
      ) {
        continue;
      }
      const name = obj.key.slice(prefix.length);
      responses.push(
        propXml(`${selfHref}${encodeURIComponent(name)}`, name, 'file', obj)
      );
    }
    for (const folder of folders) {
      if (folder.startsWith('_$flaredrive$/')) continue;
      if (
        isProtectedPath(folder, protectedList) &&
        !canReadPath(folder, identity, protectedList, rules)
      ) {
        continue;
      }
      const name = folder.slice(prefix.length, -1);
      responses.push(
        propXml(`${selfHref}${encodeURIComponent(name)}/`, name, 'collection', null)
      );
    }
  }
  return multistatus(responses);
}

async function handlePut(context, bucket, path, identity) {
  if (!path) return methodNotAllowed();
  if ((await resourceKind(bucket, path)) === 'collection') {
    return methodNotAllowed();
  }
  const db = context.env['DB'] || null;
  const ledgerIdentity = 'dav:' + (identity ? identity.user : 'unknown');
  const declared = parseInt(
    context.request.headers.get('content-length') || '', 10);
  if (db && Number.isFinite(declared)) {
    const denied = await checkUpload(
      db, path, declared, ledgerIdentity, Date.now());
    if (denied) {
      return new Response(JSON.stringify({ error: denied.code }), {
        status: denied.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  const existed = !!(await bucket.head(path));
  const contentType = context.request.headers.get('content-type');
  const obj = await bucket.put(path, context.request.body, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
  if (db) {
    const denied = await checkUpload(
      db, path, obj.size, ledgerIdentity, Date.now());
    if (denied) {
      await bucket.delete(path);
      return new Response(JSON.stringify({ error: denied.code }), {
        status: denied.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await recordUpload(db, path, obj.size, ledgerIdentity, Date.now());
    await sweepExpired(db, bucket, Date.now(), 50);
  }
  return new Response(null, { status: existed ? 204 : 201 });
}

async function handleDelete(context, bucket, path) {
  if (!path) return methodNotAllowed();
  const kind = await resourceKind(bucket, path);
  if (!kind) return notFound();
  const db = context.env['DB'] || null;
  if (kind === 'file') {
    await bucket.delete(path);
    await removeLedgerRow(db, path);
    return new Response(null, { status: 204 });
  }
  const prefix = `${path}/`;
  const objects = await listAll(bucket, prefix);
  for (const obj of objects) await bucket.delete(obj.key);
  await removeLedgerRows(db, objects.map((obj) => obj.key));
  return new Response(null, { status: 204 });
}

async function handleMkcol(context, bucket, path) {
  if (!path) return methodNotAllowed();
  const contentLength = context.request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 0) {
    return new Response('MKCOL with a body is not supported', { status: 415 });
  }
  const segments = path.split('/');
  const parent = segments.slice(0, -1).join('/');
  if (!(await folderExists(bucket, parent))) {
    return new Response('Parent collection does not exist', { status: 409 });
  }
  if (await resourceKind(bucket, path)) {
    return methodNotAllowed();
  }
  await bucket.put(`${path}/_$folder$`, new Uint8Array(0));
  return new Response(null, { status: 201 });
}

async function handleMoveCopy(context, bucket, path, isMove, identity) {
  const destHeader = context.request.headers.get('Destination');
  if (!destHeader) return new Response('Missing Destination', { status: 400 });
  let destUrl;
  try {
    destUrl = new URL(destHeader);
  } catch {
    return new Response('Invalid Destination', { status: 400 });
  }
  const reqUrl = new URL(context.request.url);
  if (destUrl.hostname !== reqUrl.hostname
  || !destUrl.pathname.startsWith('/dav/')) {
    return new Response('Destination must be on this DAV mount',
    { status: 400 });
  }
  const destRaw = destUrl.pathname.replace(/^\/dav\/?/, '');
  const destSegments = destRaw
    ? destRaw.split('/').filter((s) => s !== '').map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return null;
        }
      })
    : [];
  if (destSegments.includes(null)) {
    return new Response('Invalid Destination', { status: 400 });
  }
  const dest = destSegments.join('/');
  if (!dest || dest.startsWith('_$flaredrive$/')) {
    return new Response('Invalid Destination', { status: 400 });
  }

  const kind = await resourceKind(bucket, path);
  if (!kind) return notFound();
  if (kind === 'collection') {
    const depth = context.request.headers.get('Depth');
    if (depth === '0') {
      return new Response('Depth: 0 on collections is not supported',
      { status: 400 });
    }
  }
  const overwrite = (context.request.headers.get('Overwrite') || 'T')
  .toUpperCase();
  const destExisted = !!(await resourceKind(bucket, dest));
  if (destExisted && overwrite === 'F') {
    return new Response('Destination exists', { status: 412 });
  }

  const db = context.env['DB'] || null;
  const ledgerIdentity = 'dav:' + (identity ? identity.user : 'unknown');
  if (kind === 'file') {
    const src = await bucket.get(path);
    if (!src) return notFound();
    if (!isMove && db) {
      // A copy stores new bytes: it counts against quotas like an
      // upload. A move only renames the ledger row.
      const denied = await checkUpload(
        db, dest, src.size, ledgerIdentity, Date.now());
      if (denied) {
        return new Response(JSON.stringify({ error: denied.code }), {
          status: denied.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    await bucket.put(dest, src.body, {
      httpMetadata: src.httpMetadata,
      customMetadata: src.customMetadata,
    });
    if (db) {
      if (isMove) {
        await moveLedgerKey(db, path, dest);
      } else {
        await recordUpload(db, dest, src.size, ledgerIdentity, Date.now());
      }
    }
    if (isMove) await bucket.delete(path);
  } else {
    const srcPrefix = `${path}/`;
    const destPrefix = `${dest}/`;
    const objects = await listAll(bucket, srcPrefix);
    for (const obj of objects) {
      const relative = obj.key.slice(srcPrefix.length);
      const data = await bucket.get(obj.key);
      if (!data) continue;
      const destKey = destPrefix + relative;
      if (!isMove && db) {
        const denied = await checkUpload(
          db, destKey, data.size, ledgerIdentity, Date.now());
        if (denied) {
          return new Response(JSON.stringify({ error: denied.code }), {
            status: denied.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      await bucket.put(destKey, data.body, {
        httpMetadata: data.httpMetadata,
        customMetadata: data.customMetadata,
      });
      if (db) {
        if (isMove) {
          await moveLedgerKey(db, obj.key, destKey);
        } else {
          await recordUpload(
            db, destKey, data.size, ledgerIdentity, Date.now());
        }
      }
    }
    if (isMove) {
      for (const obj of objects) await bucket.delete(obj.key);
    }
  }
  return new Response(null, { status: destExisted ? 204 : 201 });
}

export async function onRequest(context) {
  const method = context.request.method;
  const [bucket] = parseBucketPath(context);
  const db = context.env['DB'] || null;
  if (!bucket) return notFound();

  // DAV on/off switch: disabled means every DAV method answers 403.
  // A corrupt settings object counts as enabled (and the management
  // endpoint reports it), matching the protection-config handling.
  const davSettings = await getDavSettings(db);
  if (!davSettings.enabled) {
    return new Response(JSON.stringify({ error: 'dav_disabled' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: { ...DAV_HEADERS, Allow: ALLOW, 'Content-Length': '0' },
    });
  }
  if (method === 'LOCK' || method === 'UNLOCK') {
    // Deliberately unimplemented: never pretend a lock was taken.
    return methodNotAllowed();
  }

  const segments = davPathSegments(context);
  if (segments === null) return new Response('Bad path encoding',
  { status: 400 });
  const path = segments.join('/');

  if (path.startsWith('_$flaredrive$/')) return notFound();

  const config = await getProtectionConfig(db);
  if (config.corrupted) return configCorruptResponse();
  // A corrupt permissions library reads as no rules: non-admins see
  // no protected path, admins are unaffected.
  const permConfig = await getPermissionsConfig(db);
  const rules = permConfig.corrupted ? [] : permConfig.rules;
  const identity = await getReadIdentity(context, db);

  // An enabled account with davEnabled=false may not use DAV at all
  // (401), even on public paths. Anonymous callers and bad credentials
  // keep the old behavior: public reads work, protected reads 401.
  if (method !== 'OPTIONS' && (await isDavDisabledIdentity(context, db))) {
    return authRequiredResponse();
  }

  const isWrite = ['PUT', 'DELETE', 'MKCOL', 'MOVE', 'COPY'].includes(method);
  if (method === 'COPY') {
    // Copy reads the source but writes the destination.
    if (!identity) return authRequiredResponse();
    if (!canReadPath(path, identity, config.protected, rules)) {
      return forbiddenResponse();
    }
  } else if (isWrite) {
    // DAV writes always need an authenticated caller with write access
    // to the affected path, even on public paths. No anonymous writes.
    // A read-only rule allows reads, never writes.
    if (!identity) return authRequiredResponse();
    if (!canWritePath(path, identity, rules)) return forbiddenResponse();
  } else if (['PROPFIND', 'GET', 'HEAD'].includes(method)) {
    if (!canReadPath(path, identity, config.protected, rules)) {
      return identity ? forbiddenResponse() : authRequiredResponse();
    }
  } else {
    return methodNotAllowed();
  }

  // MOVE/COPY also need write access to the destination prefix.
  if ((method === 'MOVE' || method === 'COPY') && identity) {
    const destHeader = context.request.headers.get('Destination') || '';
    try {
      const destUrl = new URL(destHeader);
      if (destUrl.pathname.startsWith('/dav/')) {
        const destPath = destUrl.pathname
          .replace(/^\/dav\/?/, '')
          .split('/')
          .filter((s) => s !== '')
          .map((s) => decodeURIComponent(s))
          .join('/');
        if (!canWritePath(destPath, identity, rules)) {
          return forbiddenResponse();
        }
      }
    } catch {
      // Invalid Destination is reported by the handler itself.
    }
  }

  if (method === 'PROPFIND') {
    return handlePropfind(context,
    bucket,
    path,
    segments,
    identity,
    config.protected,
    rules);
  }
  if (method === 'GET' || method === 'HEAD') {
    const kind = await resourceKind(bucket, path);
    if (!kind) return notFound();
    if (kind === 'collection') return methodNotAllowed();
    return serveR2Object(context, bucket, path, {});
  }
  if (method === 'PUT') return handlePut(context, bucket, path, identity);
  if (method === 'DELETE') return handleDelete(context, bucket, path);
  if (method === 'MKCOL') return handleMkcol(context, bucket, path);
  if (method === 'MOVE') return handleMoveCopy(context, bucket, path, true, identity);
  if (method === 'COPY') return handleMoveCopy(context, bucket, path, false, identity);
  return methodNotAllowed();
}
