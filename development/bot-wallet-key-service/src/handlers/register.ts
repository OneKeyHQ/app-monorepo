import { sha256Hex } from '../auth';
import { sendError, sendJson } from '../http-types';
import { generateBase64UrlId } from '../id';

import type { IHandlerContext } from '../http-types';
import type { IServicePersistedRecord } from '../persistence-fields';

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const AES_256_KEY_BYTES = 32;

/**
 * Strict body validator for POST /v1/bot-wallet-keys.
 *
 * Accepts ONLY `{ keyBase64: <base64 string> }`. Any extra field, missing
 * field, wrong type, or invalid base64 → INVALID_BODY (400). This is the
 * primary enforcement of the §3 trust boundary at the network layer:
 * nothing other than the random key may cross into the service.
 */
function validateRegisterBody(
  body: string,
): { ok: true; keyBase64: string } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false };
  }
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'keyBase64') {
    return { ok: false };
  }
  const keyBase64 = obj.keyBase64;
  if (typeof keyBase64 !== 'string' || keyBase64 === '') {
    return { ok: false };
  }
  if (!BASE64_RE.test(keyBase64)) {
    return { ok: false };
  }
  // sanity: must round-trip through Buffer
  let decoded: Buffer;
  try {
    decoded = Buffer.from(keyBase64, 'base64');
  } catch {
    return { ok: false };
  }
  if (decoded.length !== AES_256_KEY_BYTES) {
    return { ok: false };
  }
  // Re-encode and compare to reject "mostly-base64" inputs (e.g. trailing
  // junk) that Buffer.from silently truncates.
  if (decoded.toString('base64') !== keyBase64) {
    return { ok: false };
  }
  return { ok: true, keyBase64 };
}

export function handleRegister(ctx: IHandlerContext): void {
  const validation = validateRegisterBody(ctx.body);
  if (!validation.ok) {
    sendError(ctx.res, 400, 'INVALID_BODY');
    return;
  }
  const keyId = generateBase64UrlId();
  const accessToken = generateBase64UrlId();
  const record: IServicePersistedRecord = {
    keyBase64: validation.keyBase64,
    accessTokenSha256: sha256Hex(accessToken),
    createdAt: ctx.now(),
  };
  try {
    ctx.store.insert(keyId, record);
  } catch (e) {
    process.stderr.write(`register: store.insert failed: ${String(e)}\n`);
    sendError(ctx.res, 500, 'INTERNAL');
    return;
  }
  // Plaintext accessToken is returned EXACTLY ONCE here and never persisted.
  sendJson(ctx.res, 200, { keyId, accessToken });
}
