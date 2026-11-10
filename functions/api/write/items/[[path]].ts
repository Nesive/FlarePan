import { get_auth_status } from '@/utils/auth';
import { notFound, parseBucketPath } from '@/utils/bucket';
import { hasFolderMarkerSegment } from '@/utils/folder-marker';
import { resolveUploadContentType } from '@/utils/media-types';
import { requireAdminCookie } from '@/utils/read-auth';
import {
  checkUpload,
  recordUpload,
  removeLedgerRow,
  requestIdentity,
  reserveMultipart,
  sweepExpired,
  takeReservation,
} from '@/utils/upload-limits';

export async function onRequestPostCreateMultipart(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  // "_$folder$" is a reserved segment: no upload may be named that,
  // and nothing may be stored under a marker path.
  if (hasFolderMarkerSegment(path)) {
    return new Response('invalid_key', { status: 400 });
  }

  const request: Request = context.request;
  const db = context.env['DB'] || null;

  // Declared-size check: the client (main.mjs) sends fd-total-size, so
  // an over-quota upload is refused before any part is stored. Without
  // the header there is nothing to check yet; the complete step still
  // verifies the real size and deletes an over-quota object.
  const declared = parseInt(
    request.headers.get('fd-total-size') || '', 10);
  let identity = null;
  if (db && Number.isFinite(declared)) {
    identity = await requestIdentity(request);
    const denied = await checkUpload(
      db, path, declared, identity, Date.now());
    if (denied) {
      return new Response(JSON.stringify({ error: denied.code }), {
        status: denied.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const customMetadata: Record<string, string> = {};
  if (request.headers.has('fd-thumbnail'))
    customMetadata.thumbnail = request.headers.get('fd-thumbnail');

  const multipartUpload = await bucket.createMultipartUpload(path, {
    httpMetadata: {
      contentType: resolveUploadContentType(
        request.headers.get('content-type'), path),
    },
    customMetadata,
  });

  if (db && Number.isFinite(declared)) {
    await reserveMultipart(
      db, multipartUpload.uploadId, path, identity, declared, Date.now());
  }

  return new Response(
    JSON.stringify({
      key: multipartUpload.key,
      uploadId: multipartUpload.uploadId,
    })
  );
}

export async function onRequestPostCompleteMultipart(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;
  const url = new URL(request.url);
  const uploadId = new URLSearchParams(url.search).get('uploadId');
  const multipartUpload = await bucket.resumeMultipartUpload(path, uploadId);
  const db = context.env['DB'] || null;

  const completeBody: { parts: Array<any> } = await request.json();

  // The reservation is consumed before completing so the daily sum
  // does not double-count it against the finished object below.
  const reservation = await takeReservation(db, uploadId);

  try {
    const object = await multipartUpload.complete(completeBody.parts);
    if (db) {
      const identity = reservation
        ? reservation.identity
        : await requestIdentity(request);
      const denied = await checkUpload(
        db, path, object.size, identity, Date.now());
      if (denied) {
        // A lying fd-total-size (or no header at all) still cannot
        // persist an over-quota file: it is deleted right away.
        await bucket.delete(path);
        return new Response(JSON.stringify({ error: denied.code }), {
          status: denied.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await recordUpload(db, path, object.size, identity, Date.now());
      await sweepExpired(db, bucket, Date.now(), 50);
    }
    return new Response(null, {
      headers: { etag: object.httpEtag },
    });
  } catch (error: any) {
    return new Response(error.message, { status: 400 });
  }
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const searchParams = new URLSearchParams(url.search);

  if (searchParams.has('uploads')) {
    return onRequestPostCreateMultipart(context);
  }

  if (searchParams.has('uploadId')) {
    return onRequestPostCompleteMultipart(context);
  }

  return new Response('Method not allowed', { status: 405 });
}

export async function onRequestPutMultipart(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;
  const url = new URL(request.url);

  const uploadId = new URLSearchParams(url.search).get('uploadId');
  const multipartUpload = await bucket.resumeMultipartUpload(path, uploadId);

  const partNumber = parseInt(
    new URLSearchParams(url.search).get('partNumber')
  );
  const uploadedPart = await multipartUpload.uploadPart(
    partNumber,
    request.body
  );

  return new Response(null, {
    headers: {
      'Content-Type': 'application/json',
      etag: uploadedPart.etag,
    },
  });
}

export async function onRequestPut(context) {
  if (!get_auth_status(context)) {
    // The admin UI logs in by cookie session, not Basic, so a valid
    // admin cookie is accepted here too (admins always have write
    // access). Anything else keeps the original 401 exactly.
    const db = context.env['DB'] || null;
    let adminOk = false;
    if (db) {
      const gate = await requireAdminCookie(context, db);
      if (!(gate instanceof Response)) adminOk = true;
    }
    if (!adminOk) {
      // No Basic challenge here: this is a web UI call, and a
      // challenge would make the browser pop its native login dialog.
      // (DAV keeps its own challenge; see utils/read-auth.ts.)
      const header = new Headers();
      return new Response('没有操作权限', {
          status: 401,
          headers: header,
      });
    }
  }
  const url = new URL(context.request.url);

  if (new URLSearchParams(url.search).has('uploadId')) {
    return onRequestPutMultipart(context);
  }

  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  // "_$folder$" is a reserved segment (see create-multipart above).
  if (hasFolderMarkerSegment(path)) {
    return new Response('invalid_key', { status: 400 });
  }

  const request: Request = context.request;
  const db = context.env['DB'] || null;

  // Early refusal when the declared length already exceeds a cap
  // (a copy source has no meaningful length; it is verified after).
  let identity = null;
  const declared = parseInt(
    request.headers.get('content-length') || '', 10);
  if (db && !request.headers.has('x-amz-copy-source')
    && Number.isFinite(declared)) {
    identity = await requestIdentity(request);
    const denied = await checkUpload(
      db, path, declared, identity, Date.now());
    if (denied) {
      return new Response(JSON.stringify({ error: denied.code }), {
        status: denied.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let content = request.body;
  const customMetadata: Record<string, string> = {};
  // Copy branch: keep the source object's metadata. The stored
  // Content-Type wins when it is a real type; an octet-stream or
  // missing source type falls back to the same header -> extension
  // resolution as a fresh upload (so a copy of a legacy octet-stream
  // object still lands with a usable type).
  let sourceHttpMetadata = null;

  if (request.headers.has('x-amz-copy-source')) {
    const sourceName = decodeURIComponent(
      request.headers.get('x-amz-copy-source')
    );
    // A marker is not a file: it cannot be copied as one.
    if (hasFolderMarkerSegment(sourceName)) {
      return new Response('invalid_key', { status: 400 });
    }
    const source = await bucket.get(sourceName);
    content = source.body;
    Object.assign(customMetadata, source.customMetadata || {});
    sourceHttpMetadata = source.httpMetadata || null;
  }

  if (request.headers.has('fd-thumbnail'))
    customMetadata.thumbnail = request.headers.get('fd-thumbnail');

  const sourceType = (sourceHttpMetadata?.contentType || '').trim();
  const sourceTypeLower = sourceType.toLowerCase();
  const contentType = sourceType
    && sourceTypeLower !== 'application/octet-stream'
    && !sourceTypeLower.startsWith('application/octet-stream;')
    ? sourceType
    : resolveUploadContentType(
        request.headers.get('content-type'), path);

  const obj = await bucket.put(path, content, {
    httpMetadata: {
      ...(sourceHttpMetadata || {}),
      contentType,
    },
    customMetadata,
  });
  if (db) {
    if (!identity) identity = await requestIdentity(request);
    const denied = await checkUpload(
      db, path, obj.size, identity, Date.now());
    if (denied) {
      await bucket.delete(path);
      return new Response(JSON.stringify({ error: denied.code }), {
        status: denied.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await recordUpload(db, path, obj.size, identity, Date.now());
    await sweepExpired(db, bucket, Date.now(), 50);
  }
  const { key, size, uploaded } = obj;
  return new Response(JSON.stringify({ key, size, uploaded }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestDelete(context) {
  if (!get_auth_status(context)) {
    // No Basic challenge here either (see the PUT handler above).
    const header = new Headers();
    return new Response('没有操作权限', {
        status: 401,
        headers: header,
    });
  }
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  await bucket.delete(path);
  await removeLedgerRow(context.env['DB'] || null, path);
  return new Response(null, { status: 204 });
}
