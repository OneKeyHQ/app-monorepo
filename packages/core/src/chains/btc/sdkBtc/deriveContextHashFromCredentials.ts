import { getBitcoinBip32 } from '.';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  decryptImportedCredential,
  decryptRevealableSeed,
} from '../../../secret';

import { deriveContextHash, parseHexContext } from './deriveContextHash';

import type {
  ICoreCredentialsInfo,
  ICoreHdCredentialEncryptHex,
  ICoreImportedCredentialEncryptHex,
} from '../../../types';

async function deriveFromHd({
  hdCredential,
  password,
  leafPath,
  appName,
  contextBytes,
}: {
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  leafPath: string;
  appName: string;
  contextBytes: Uint8Array;
}): Promise<string> {
  // Use the stored seed directly — it already incorporates any BIP-39
  // passphrase. Reconstructing via mnemonicToSeed would silently break
  // passphrase users.
  const rs = await decryptRevealableSeed({ rs: hdCredential, password });
  const seed = bufferUtils.toBuffer(rs.seed);
  const root = getBitcoinBip32().fromSeed(seed);
  const child = root.derivePath(leafPath);
  if (!child.privateKey) {
    throw new OneKeyLocalError(
      'BIP-32 derivation produced no private key for deriveContextHash',
    );
  }
  const ikm = new Uint8Array(child.privateKey);
  try {
    return deriveContextHash(ikm, appName, contextBytes);
  } finally {
    // Best-effort zeroing; bip32 internal state may retain copies.
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

/**
 * BTC `deriveContextHash` orchestration. HD = per-public-key output (IKM is
 * the connected leaf's BIP-32 private key at `leafPath`; different leaves
 * → different outputs). Imported = per-key output (raw imported privkey).
 * Caller does user approval; we still validate defensively.
 */
export async function deriveContextHashFromBtcCredentials({
  credentials,
  password,
  leafPath,
  appName,
  context,
}: {
  credentials: ICoreCredentialsInfo;
  password: string;
  leafPath?: string;
  appName: string;
  context: string;
}): Promise<string> {
  const contextBytes = parseHexContext(context);

  // Fail-closed: keyrings populate exactly one of hd/imported.
  if (credentials.hd && credentials.imported) {
    throw new OneKeyLocalError(
      'deriveContextHash got ambiguous credentials (both hd and imported set)',
    );
  }

  if (credentials.hd) {
    if (!leafPath) {
      throw new OneKeyLocalError(
        'deriveContextHash requires a connected leaf BIP-32 path for HD credentials',
      );
    }
    return deriveFromHd({
      hdCredential: credentials.hd,
      password,
      leafPath,
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
