// HKDF-SHA-256 with info = SHA-256(appName) || SHA-256(network) || pubkey(33B) || context.
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Purpose index 73681862 = trunc31_be(SHA-256("derive-context-hash")).
export const DERIVE_CONTEXT_HASH_BIP32_PATH: string = "m/73681862'";

const SALT = 'derive-context-hash';
const OUTPUT_LENGTH = 32;
const APP_NAME_HASH_LENGTH = 32;
const NETWORK_HASH_LENGTH = 32;
const COMPRESSED_PUBKEY_LENGTH = 33;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateAppName(appName: string): void {
  if (typeof appName !== 'string' || appName.length === 0) {
    throw new OneKeyLocalError('appName must be a non-empty string');
  }
  const bytes = new TextEncoder().encode(appName);
  if (bytes.length > 64) {
    throw new OneKeyLocalError(
      `appName must be at most 64 bytes, got ${bytes.length}`,
    );
  }
  if (!/^[a-z0-9-]+$/.test(appName)) {
    throw new OneKeyLocalError(
      'appName must contain only lowercase letters, digits, and hyphens',
    );
  }
}

// Empty is valid (info ends with variable-length context).
export function parseHexContext(context: string): Uint8Array {
  if (typeof context !== 'string') {
    throw new OneKeyLocalError('Context must be a string');
  }
  if (context.startsWith('0x') || context.startsWith('0X')) {
    throw new OneKeyLocalError('Context must not have a 0x prefix');
  }
  if (context.length % 2 !== 0) {
    throw new OneKeyLocalError('Context must be an even-length hex string');
  }
  if (context.length > 2048) {
    throw new OneKeyLocalError(
      'Context must not exceed 2048 hex characters (1024 bytes)',
    );
  }
  if (context.length > 0 && !/^[0-9a-f]+$/.test(context)) {
    throw new OneKeyLocalError('Context must be a lowercase hex string');
  }
  const bytes = new Uint8Array(context.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(context.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function deriveContextHash(
  ikm: Uint8Array,
  appName: string,
  canonicalNetworkName: string,
  connectedPubkey: Uint8Array,
  context: Uint8Array,
): string {
  if (ikm.length !== 32) {
    throw new OneKeyLocalError(
      `Input key material must be 32 bytes, got ${ikm.length}`,
    );
  }
  validateAppName(appName);
  if (connectedPubkey.length !== COMPRESSED_PUBKEY_LENGTH) {
    throw new OneKeyLocalError(
      `connectedPubkey must be ${COMPRESSED_PUBKEY_LENGTH} bytes (compressed SEC1), got ${connectedPubkey.length}`,
    );
  }
  const parity = connectedPubkey[0];
  if (parity !== 0x02 && parity !== 0x03) {
    throw new OneKeyLocalError(
      `connectedPubkey must start with 0x02 or 0x03 (compressed SEC1 parity), got 0x${parity
        .toString(16)
        .padStart(2, '0')}`,
    );
  }

  const appNameHash = sha256(new TextEncoder().encode(appName));
  const networkHash = sha256(new TextEncoder().encode(canonicalNetworkName));

  const info = new Uint8Array(
    APP_NAME_HASH_LENGTH +
      NETWORK_HASH_LENGTH +
      COMPRESSED_PUBKEY_LENGTH +
      context.length,
  );
  let offset = 0;
  info.set(appNameHash, offset);
  offset += APP_NAME_HASH_LENGTH;
  info.set(networkHash, offset);
  offset += NETWORK_HASH_LENGTH;
  info.set(connectedPubkey, offset);
  offset += COMPRESSED_PUBKEY_LENGTH;
  info.set(context, offset);

  const derived = hkdf(sha256, ikm, SALT, info, OUTPUT_LENGTH);
  const result = toHex(derived);

  derived.fill(0);
  info.fill(0);
  appNameHash.fill(0);
  networkHash.fill(0);

  return result;
}
