import { type CipherGCM, createCipheriv, randomBytes } from 'crypto';

import { OneKeyLocalError } from '../../errors';
import { stableStringify } from '../stringUtils';

import type { ICliBotWalletRevealableSeed } from '../../types/cliBotWallet';

const ALGO = 'aes-256-gcm' as const;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Result of `encryptCredential`. The caller is responsible for `secureWipe`-ing
 * `randomKey` immediately after registering it with the local key service.
 */
export type IEncryptCredentialResult = {
  ciphertextBase64: string;
  randomKey: Buffer;
};

/**
 * Encrypt a serialized `IBip39RevealableSeed` with a fresh CSPRNG AES-256-GCM
 * key. Layout of `ciphertextBase64`:
 *
 *     | nonce (12B) | ciphertext (N B) | auth tag (16B) |
 *
 * The same scheme is used by every CLI client and the local key service spec
 * (project-context.md §2). The returned `randomKey` is the only copy of the
 * AES key in memory — register it with the key service and then call
 * `secureWipe(randomKey)`.
 */
export function encryptCredential(
  seed: ICliBotWalletRevealableSeed,
): IEncryptCredentialResult {
  const randomKey = randomBytes(KEY_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const plaintext = Buffer.from(stableStringify(seed), 'utf8');
  const cipher: CipherGCM = createCipheriv(ALGO, randomKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // wipe the plaintext immediately
  plaintext.fill(0);
  const blob = Buffer.concat([nonce, ciphertext, authTag]);
  return {
    ciphertextBase64: blob.toString('base64'),
    randomKey,
  };
}

/**
 * Inverse of `encryptCredential`. Used only by tests on the sender side; the
 * CLI runs the equivalent decrypt path itself.
 */
export function decryptCredential(
  ciphertextBase64: string,
  randomKey: Buffer,
): ICliBotWalletRevealableSeed {
  if (randomKey.length !== KEY_BYTES) {
    throw new OneKeyLocalError(`encrypt: randomKey must be ${KEY_BYTES} bytes`);
  }
  const blob = Buffer.from(ciphertextBase64, 'base64');
  if (blob.length < NONCE_BYTES + TAG_BYTES) {
    throw new OneKeyLocalError('encrypt: ciphertext blob too short');
  }
  const nonce = blob.subarray(0, NONCE_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES, blob.length - TAG_BYTES);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decipher = (
    require('crypto') as typeof import('crypto')
  ).createDecipheriv(ALGO, randomKey, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  const text = plaintext.toString('utf8');
  plaintext.fill(0);
  return JSON.parse(text) as ICliBotWalletRevealableSeed;
}

/**
 * Constants exported for tests / cross-checking with the receiving CLI side.
 */
export const ENCRYPT_LAYOUT = {
  algorithm: ALGO,
  keyBytes: KEY_BYTES,
  nonceBytes: NONCE_BYTES,
  tagBytes: TAG_BYTES,
} as const;

/**
 * Zero out a Buffer in place. Mirrors `apps/cli/src/core/crypto-utils.ts` so
 * the sender side has a callable stub without pulling a CLI-only dep.
 */
export function secureWipe(buffer: Buffer): void {
  buffer.fill(0);
}
