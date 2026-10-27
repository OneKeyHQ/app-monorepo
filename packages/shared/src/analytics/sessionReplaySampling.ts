/* cspell:words unhex */
// Session Replay sampling. Pure functions shared by every platform.
//
// The bucket must stay identical to the HogQL used for the sampling audit:
//   reinterpretAsUInt32(reverse(unhex(substring(session_id, 29, 8)))) % 10000
// i.e. the last 8 hex digits of the canonical UUID read as a big-endian uint32.

export const REPLAY_BUCKET_COUNT = 10_000;

const CANONICAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getReplayBucket(
  sessionId: string | null | undefined,
): number | undefined {
  if (typeof sessionId !== 'string' || !CANONICAL_UUID_RE.test(sessionId)) {
    return undefined;
  }
  const tail = sessionId.replace(/-/g, '').slice(-8);
  const value = Number.parseInt(tail, 16);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value % REPLAY_BUCKET_COUNT;
}

// `threshold` is in buckets out of 10000 (300 = 3%). Malformed ids and
// non-finite thresholds are never sampled.
export function isReplaySampled(
  sessionId: string | null | undefined,
  threshold: number,
): boolean {
  const bucket = getReplayBucket(sessionId);
  return bucket !== undefined && bucket < threshold;
}
