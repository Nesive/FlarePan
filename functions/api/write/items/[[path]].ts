import { get_auth_status } from '@/utils/auth';
import { notFound, parseBucketPath } from '@/utils/bucket';
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
      contentType: request.headers.get('content-type'),
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
    const header = new Headers();
    header.set('WWW-Authenticate','Basic realm="需要登录"');
    return new Response('没有操作权限', {
        status: 401,
        headers: header,
    });
  }
  const url = new URL(context.request.url);

  if (new URLSearchParams(url.search).has('uploadId')) {
    return onRequestPutMultipart(context);
  }

  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

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

  if (request.headers.has('x-amz-copy-source')) {
    const sourceName = decodeURIComponent(
      request.headers.get('x-amz-copy-source')
    );
    const source = await bucket.get(sourceName);
    content = source.body;
    if (source.customMetadata.thumbnail)
      customMetadata.thumbnail = source.customMetadata.thumbnail;
  }

  if (request.headers.has('fd-thumbnail'))
    customMetadata.thumbnail = request.headers.get('fd-thumbnail');

  const obj = await bucket.put(path, content, { customMetadata });
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
    const header = new Headers();
    header.set('WWW-Authenticate','Basic realm="需要登录"');
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
