import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * Deterministic context-based key derivation using HKDF (RFC 5869).
 *
 * Derivation scheme:
 *   ikm    = 32-byte private key (BIP-32 derived at m/73681862' for HD wallets,
 *            or raw imported key for imported keys)
 *   salt   = "derive-context-hash"
 *   info   = SHA-256(UTF8(appName)) || contextBytes
 *   output = HKDF-SHA-256(ikm, salt, info, 32)
 *
 * Validation rules:
 *   - appName: 1-64 bytes, must match /^[a-z0-9-]+$/
 *   - context: 1-2048 lowercase hex chars, even-length, no `0x` prefix
 *   - output: 64 lowercase hex chars
 */

const SALT = 'derive-context-hash';
const OUTPUT_LENGTH = 32;
const APP_NAME_MAX_BYTES = 64;
const CONTEXT_MAX_HEX_CHARS = 2048;
const CONTEXT_MAX_BYTES = CONTEXT_MAX_HEX_CHARS / 2; // 1024
const APP_NAME_REGEX = /^[a-z0-9-]+$/;
const HEX_REGEX = /^[0-9a-f]+$/;

/**
 * BIP-32 hardened path used as IKM for HD wallets.
 * Purpose index = trunc31_be(SHA-256("derive-context-hash")).
 */
export const DERIVE_CONTEXT_HASH_BIP32_PATH = "m/73681862'";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate the appName parameter per spec.
 * Must be 1–64 bytes, ASCII lowercase letters, digits, and hyphens only.
 */
export function validateAppName(appName: string): void {
  if (typeof appName !== 'string' || appName.length === 0) {
    throw new OneKeyLocalError('appName must be a non-empty string');
  }
  const bytes = new TextEncoder().encode(appName);
  if (bytes.length > APP_NAME_MAX_BYTES) {
    throw new OneKeyLocalError(
      `appName must be at most ${APP_NAME_MAX_BYTES} bytes, got ${bytes.length}`,
    );
  }
  if (!APP_NAME_REGEX.test(appName)) {
    throw new OneKeyLocalError(
      'appName must contain only lowercase letters, digits, and hyphens',
    );
  }
}

/**
 * Parse a hex-encoded context string into a Uint8Array.
 * Validates per spec: non-empty, even-length, lowercase hex only,
 * no `0x` prefix, max 2048 hex characters (1024 bytes).
 */
export function parseHexContext(context: string): Uint8Array {
  if (typeof context !== 'string' || context.length === 0) {
    throw new OneKeyLocalError('context must be a non-empty string');
  }
  if (context.startsWith('0x') || context.startsWith('0X')) {
    throw new OneKeyLocalError('context must not have a 0x prefix');
  }
  if (context.length % 2 !== 0) {
    throw new OneKeyLocalError('context must be an even-length hex string');
  }
  if (context.length > CONTEXT_MAX_HEX_CHARS) {
    throw new OneKeyLocalError(
      `context must not exceed ${CONTEXT_MAX_HEX_CHARS} hex characters (1024 bytes)`,
    );
  }
  if (!HEX_REGEX.test(context)) {
    throw new OneKeyLocalError('context must be a lowercase hex string');
  }
  const bytes = new Uint8Array(context.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(context.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derive a deterministic 32-byte value from key material, app name, and context bytes.
 *
 * Caller is responsible for zeroing `ikm` after this returns. This function
 * zeros its own intermediate buffers (the derived output before returning hex,
 * and the constructed info buffer).
 *
 * @param ikm     Input key material — must be exactly 32 bytes.
 * @param appName Application identifier (validated against spec).
 * @param context Already-decoded context bytes (use {@link parseHexContext}).
 * @returns Hex-encoded 32-byte derived value (64 lowercase hex chars).
 */
export function deriveContextHash(
  ikm: Uint8Array,
  appName: string,
  context: Uint8Array,
): string {
  if (ikm.length !== OUTPUT_LENGTH) {
    throw new OneKeyLocalError(
      `Input key material must be ${OUTPUT_LENGTH} bytes, got ${ikm.length}`,
    );
  }
  // Defense-in-depth: enforce the spec's context size invariants at the
  // byte-level API too. parseHexContext already enforces these on string
  // inputs, but a direct byte-level caller would otherwise bypass them.
  if (context.length === 0) {
    throw new OneKeyLocalError('context must be non-empty');
  }
  if (context.length > CONTEXT_MAX_BYTES) {
    throw new OneKeyLocalError(
      `context must not exceed ${CONTEXT_MAX_BYTES} bytes, got ${context.length}`,
    );
  }

  validateAppName(appName);

  const appNameHash = sha256(new TextEncoder().encode(appName));
  const info = new Uint8Array(appNameHash.length + context.length);
  info.set(appNameHash, 0);
  info.set(context, appNameHash.length);

  const derived = hkdf(sha256, ikm, SALT, info, OUTPUT_LENGTH);
  try {
    return toHex(derived);
  } finally {
    derived.fill(0);
    info.fill(0);
  }
}
