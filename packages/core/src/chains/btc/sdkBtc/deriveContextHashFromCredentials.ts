import { getBitcoinBip32 } from '.';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  decryptImportedCredential,
  decryptRevealableSeed,
} from '../../../secret';

import {
  DERIVE_CONTEXT_HASH_BIP32_PATH,
  deriveContextHash,
  parseHexContext,
} from './deriveContextHash';

import type {
  ICoreCredentialsInfo,
  ICoreHdCredentialEncryptHex,
  ICoreImportedCredentialEncryptHex,
} from '../../../types';

/**
 * BTC-specific orchestration around the pure HKDF derivation in
 * {@link deriveContextHash}. Pulls 32-byte input key material from either:
 *   - HD credentials → BIP-32 derive at {@link DERIVE_CONTEXT_HASH_BIP32_PATH}
 *   - Imported credentials → raw private key
 *
 * Caller is responsible for prior user approval (this function performs no
 * user-facing checks). Caller must provide an already-validated `appName`
 * and `context` per the spec — this function still validates them defensively
 * via the inner `deriveContextHash` / `parseHexContext` calls.
 */
export async function deriveContextHashFromBtcCredentials({
  credentials,
  password,
  appName,
  context,
}: {
  credentials: ICoreCredentialsInfo;
  password: string;
  appName: string;
  context: string;
}): Promise<string> {
  const contextBytes = parseHexContext(context);

  // Fail-closed: keyrings populate exactly one of hd/imported. Both being
  // present would be ambiguous credential state — refuse rather than guess.
  if (credentials.hd && credentials.imported) {
    throw new OneKeyLocalError(
      'deriveContextHash got ambiguous credentials (both hd and imported set)',
    );
  }

  if (credentials.hd) {
    return deriveFromHd({
      hdCredential: credentials.hd,
      password,
      appName,
      contextBytes,
    });
  }

  if (credentials.imported) {
    return deriveFromImported({
      importedCredential: credentials.imported,
      password,
      appName,
      contextBytes,
    });
  }

  throw new OneKeyLocalError(
    'deriveContextHash requires HD or imported credentials',
  );
}

async function deriveFromHd({
  hdCredential,
  password,
  appName,
  contextBytes,
}: {
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  appName: string;
  contextBytes: Uint8Array;
}): Promise<string> {
  // Use the wallet's stored BIP-39 seed directly. The seed already
  // incorporates any BIP-39 passphrase used at wallet creation, so HD wallets
  // with passphrase produce a different (correct) `deriveContextHash` than
  // wallets without. Reconstructing seed from entropy → mnemonic →
  // mnemonicToSeed without passphrase would silently break passphrase users.
  // This also avoids materializing the mnemonic string (which can't be zeroed
  // in JS) and matches the canonical seed-access pattern used elsewhere in
  // the codebase (see secret/index.ts → generateMasterKeyFromSeed).
  const rs = await decryptRevealableSeed({ rs: hdCredential, password });
  const seed = bufferUtils.toBuffer(rs.seed);
  const root = getBitcoinBip32().fromSeed(seed);
  const child = root.derivePath(DERIVE_CONTEXT_HASH_BIP32_PATH);
  if (!child.privateKey) {
    throw new OneKeyLocalError(
      'BIP-32 derivation produced no private key for deriveContextHash',
    );
  }
  const ikm = new Uint8Array(child.privateKey);
  try {
    return deriveContextHash(ikm, appName, contextBytes);
  } finally {
    // Best-effort zeroing of intermediate key material. bip32 internal node
    // state (root, parent nodes) may retain copies — we wipe what we
    // directly hold: the IKM, the derived child's private-key Buffer, the
    // root's private-key Buffer, and the seed Buffer.
    ikm.fill(0);
    if (child.privateKey) {
      child.privateKey.fill(0);
    }
    if (root.privateKey) {
      root.privateKey.fill(0);
    }
    seed.fill(0);
  }
}

async function deriveFromImported({
  importedCredential,
  password,
  appName,
  contextBytes,
}: {
  importedCredential: ICoreImportedCredentialEncryptHex;
  password: string;
  appName: string;
  contextBytes: Uint8Array;
}): Promise<string> {
  const { privateKey: privateKeyHex } = await decryptImportedCredential({
    credential: importedCredential,
    password,
  });
  if (
    typeof privateKeyHex !== 'string' ||
    privateKeyHex.length === 0 ||
    !/^[0-9a-fA-F]+$/.test(privateKeyHex) ||
    privateKeyHex.length % 2 !== 0
  ) {
    throw new OneKeyLocalError(
      'Imported credential private key is not a valid hex string',
    );
  }
  const ikm = new Uint8Array(Buffer.from(privateKeyHex, 'hex'));
  if (ikm.length !== 32) {
    ikm.fill(0);
    throw new OneKeyLocalError(
      `deriveContextHash requires a 32-byte imported private key, got ${ikm.length}`,
    );
  }
  try {
    return deriveContextHash(ikm, appName, contextBytes);
  } finally {
    ikm.fill(0);
  }
}
