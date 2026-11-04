import { notFound, parseBucketPath } from '@/utils/bucket';
import { serveR2Object } from '@/utils/r2serve';
import {
  authRequiredResponse,
  canReadPath,
  configCorruptResponse,
  forbiddenResponse,
  getPermissionsConfig,
  getProtectionConfig,
  getReadIdentity,
  shareGrantCovers,
  verifyShareGrant,
} from '@/utils/read-auth';

// Transcode-on-demand: any video format must play inside the site,
// including formats the browser cannot decode inline (mkv/avi/wmv,
// VP9/AV1-in-mp4, 10-bit H.264, ...). The browser tries the original
// first; on error the frontend falls back here.
//
// Protocol (R2-backed, no new tunnel or credentials):
// - GET /transcode/<source key> checks the cache first:
//   _$transcoded$/<key>.done.json must match the live source etag+size
//   and _$transcoded$/<key>.mp4 must exist; then the cached H.264 MP4
//   bytes are served (Range-capable, same as /raw/).
// - Otherwise a job _$transcode-jobs$/<key>.json is created (if absent)
//   for the server transcode worker, and the response is 202 JSON
//   {status:'queued'}. The frontend polls until bytes arrive.
// - A failed marker _$transcoded$/<key>.failed.json yields JSON
//   {status:'failed'}; ?retry=1 clears it and re-queues.
// - The cache inherits the SOURCE's protection: the same read checks
//   as /raw/ run against the source key. The internal prefixes are
//   never servable via /raw/ or listings (see those routes).

const TRANSCODED_PREFIX = '_$transcoded$/';
const JOBS_PREFIX = '_$transcode-jobs$/';

function transcodeKeys(sourceKey) {
  return {
    doneKey: `${TRANSCODED_PREFIX}${sourceKey}.done.json`,
    outputKey: `${TRANSCODED_PREFIX}${sourceKey}.mp4`,
    failedKey: `${TRANSCODED_PREFIX}${sourceKey}.failed.json`,
    jobKey: `${JOBS_PREFIX}${sourceKey}.json`,
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ETags may or may not arrive quoted depending on the caller; compare
// without surrounding quotes so a cached entry is never missed.
function normEtag(etag) {
  return (etag || '').replace(/^"|"$/g, '');
}

export async function onRequestGet(context) {
  const [bucket, sourceKey] = parseBucketPath(context);
  const db = context.env['DB'] || null;
  if (!bucket || !sourceKey) return notFound();
  // Internal prefixes are never transcode sources.
  if (
    sourceKey.startsWith(TRANSCODED_PREFIX) ||
    sourceKey.startsWith(JOBS_PREFIX)
  ) {
    return notFound();
  }
  // Same read protection as /raw/, checked against the SOURCE key.
  const config = await getProtectionConfig(db);
  if (config.corrupted) return configCorruptResponse();
  const permConfig = await getPermissionsConfig(db);
  const rules = permConfig.corrupted ? [] : permConfig.rules;
  const identity = await getReadIdentity(context, db);
  const grant = await verifyShareGrant(context, db);
  if (
    !canReadPath(sourceKey, identity, config.protected, rules) &&
    !shareGrantCovers(grant, sourceKey)
  ) {
    return identity || grant ? forbiddenResponse() : authRequiredResponse();
  }

  const sourceHead = await bucket.head(sourceKey);
  if (!sourceHead) return notFound();
  const { doneKey, outputKey, failedKey, jobKey } = transcodeKeys(sourceKey);

  const url = new URL(context.request.url);
  if (url.searchParams.get('retry') === '1') {
    await bucket.delete(failedKey);
  } else {
    const failed = await bucket.get(failedKey);
    if (failed) {
      let reason = '';
      try {
        reason = (await failed.json()).reason || '';
      } catch (e) {
        // Malformed marker: treat as a plain failure.
      }
      return jsonResponse({ status: 'failed', reason }, 200);
    }
  }

  const done = await bucket.get(doneKey);
  if (done) {
    let meta = null;
    try {
      meta = await done.json();
    } catch (e) {
      // Malformed marker: fall through to re-queue.
    }
    if (
      meta &&
      normEtag(meta.etag) === normEtag(sourceHead.httpEtag) &&
      meta.size === sourceHead.size
    ) {
      const outputHead = await bucket.head(outputKey);
      if (outputHead) {
        return serveR2Object(context, bucket, outputKey, {});
      }
    }
  }

  const existingJob = await bucket.head(jobKey);
  if (!existingJob) {
    await bucket.put(
      jobKey,
      JSON.stringify({ key: sourceKey, requestedAt: Date.now() }),
      { httpMetadata: { contentType: 'application/json' } }
    );
  }
  return jsonResponse({ status: 'queued' }, 202);
}
