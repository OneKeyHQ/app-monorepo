import { cryptoBridge } from './crypto-bridge';

const BEARER_PREFIX = 'Bearer ';

export type IBearerExtractResult =
  | { ok: true; tokenBase64Url: string }
  | { ok: false; reason: 'missing' | 'malformed' };

/**
 * Parse `Authorization: Bearer <base64url>` header. Returns a single
 * `ok: false` shape regardless of which sub-condition failed — the caller
 * MUST collapse all parse failures into a single 401 response (no error-cause
 * disclosure, NFR18 timing/error-shape parity).
 */
export function extractBearerToken(
  authorizationHeader: string | undefined,
): IBearerExtractResult {
  if (typeof authorizationHeader !== 'string' || authorizationHeader === '') {
    return { ok: false, reason: 'missing' };
  }
  if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
    return { ok: false, reason: 'malformed' };
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (token === '' || !isBase64Url(token)) {
    return { ok: false, reason: 'malformed' };
  }
  return { ok: true, tokenBase64Url: token };
}

const BASE64_URL_RE = /^[A-Za-z0-9_-]+$/;
function isBase64Url(s: string): boolean {
  return BASE64_URL_RE.test(s);
}

export function sha256Hex(input: string | Buffer): string {
  return cryptoBridge.createHash('sha256').update(input).digest('hex');
}

/**
 * Constant-time comparison of `sha256(presentedToken)` against the stored
 * sha256 hash. The buffer length is fixed to 32 bytes (sha256 digest), so the
 * length check is implicit. Always uses `crypto.timingSafeEqual` — never
 * `===` or string equality — to neutralize byte-by-byte timing side channels.
 */
export function verifyAccessToken(
  presentedTokenBase64Url: string,
  storedSha256Hex: string,
): boolean {
  const presentedHash = cryptoBridge
    .createHash('sha256')
    .update(presentedTokenBase64Url)
    .digest();
  let storedHash: Buffer;
  try {
    storedHash = Buffer.from(storedSha256Hex, 'hex');
  } catch {
    return false;
  }
  if (storedHash.length !== presentedHash.length) {
    // Pad to 32 to keep the timingSafeEqual call well-formed regardless of
    // stored corruption — but still return false. Avoids leaking a
    // distinguishable error path for malformed stored hashes.
    return false;
  }
  return cryptoBridge.timingSafeEqual(presentedHash, storedHash);
}
