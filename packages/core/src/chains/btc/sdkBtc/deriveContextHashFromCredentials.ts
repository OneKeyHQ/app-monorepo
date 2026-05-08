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
  // Outer try/finally ensures `seed` (and any reachable bip32 state) is
  // zeroed even if `fromSeed` or `derivePath` throws.
  let root:
    | ReturnType<ReturnType<typeof getBitcoinBip32>['fromSeed']>
    | undefined;
  let child: typeof root | undefined;
  try {
    root = getBitcoinBip32().fromSeed(seed);
    child = root.derivePath(leafPath);
    if (!child?.privateKey) {
      throw new OneKeyLocalError(
        'BIP-32 derivation produced no private key for deriveContextHash',
      );
    }
    const ikm = new Uint8Array(child.privateKey);
    try {
      return deriveContextHash(ikm, appName, contextBytes);
    } finally {
      ikm.fill(0);
    }
  } finally {
    // Best-effort zeroing; bip32 internal state may retain copies.
    if (child?.privateKey) {
      child.privateKey.fill(0);
    }
    if (root?.privateKey) {
      root.privateKey.fill(0);
    }
    seed.fill(0);
  }
}

async function deriveFromImported({
  importedCredential,
  password,
  leafPath,
  appName,
  contextBytes,
}: {
  importedCredential: ICoreImportedCredentialEncryptHex;
  password: string;
  leafPath: string;
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
  // BTC imported credentials are stored as the bs58check-decoded xpriv
  // binary (78 bytes) — see `convertBtcXprvtToHex` in `sdkBtc/index.ts`.
  // Layout per BIP-32: 4 ver + 1 depth + 4 fingerprint + 4 child + 32
  // chain code + 33 key (0x00 prefix || 32-byte private scalar).
  const xprivBuf = Buffer.from(privateKeyHex, 'hex');
  if (xprivBuf.length !== 78) {
    xprivBuf.fill(0);
    throw new OneKeyLocalError(
      `Imported BTC credential must be a 78-byte serialized xpriv, got ${xprivBuf.length}`,
    );
  }
  if (xprivBuf[45] !== 0x00) {
    xprivBuf.fill(0);
    throw new OneKeyLocalError(
      'Imported BTC credential xpriv key prefix invalid (expected 0x00)',
    );
  }
  // Take owned copies so we can zero the source xpriv buffer immediately
  // after constructing the BIP-32 node — minimises the window during which
  // the raw xpriv material lives in memory.
  const chainCode = Buffer.alloc(32);
  xprivBuf.copy(chainCode, 0, 13, 45);
  const rootPrivateKey = Buffer.alloc(32);
  xprivBuf.copy(rootPrivateKey, 0, 46, 78);
  xprivBuf.fill(0);

  // Outer try/finally ensures `chainCode` and `rootPrivateKey` are zeroed
  // even if `fromPrivateKey` or `derivePath` throws (e.g. malformed
  // chainCode, invalid index, master-rooted path on a non-master node).
  let root:
    | ReturnType<ReturnType<typeof getBitcoinBip32>['fromPrivateKey']>
    | undefined;
  let child: typeof root | undefined;
  try {
    root = getBitcoinBip32().fromPrivateKey(rootPrivateKey, chainCode);
    // Imported xpriv IS the BIP-32 root, so leafPath is relative
    // (e.g. "0/0", "0/1") — not master-rooted ("m/...").
    child = root.derivePath(leafPath);
    if (!child?.privateKey) {
      throw new OneKeyLocalError(
        'BIP-32 derivation produced no private key for deriveContextHash (imported xpriv)',
      );
    }
    const ikm = new Uint8Array(child.privateKey);
    try {
      return deriveContextHash(ikm, appName, contextBytes);
    } finally {
      ikm.fill(0);
    }
  } finally {
    // Best-effort zeroing; bip32 internal state may retain copies.
    if (child?.privateKey) {
      child.privateKey.fill(0);
    }
    if (root?.privateKey) {
      root.privateKey.fill(0);
    }
    chainCode.fill(0);
    rootPrivateKey.fill(0);
  }
}

/**
 * BTC `deriveContextHash` orchestration. Output is per-public-key for both
 * HD and imported. IKM is the connected leaf's BIP-32 private key:
 *
 * - HD: derived from the BIP-39 seed at `leafPath` (master-rooted, e.g.
 *   `m/44'/0'/0'/0/0`).
 * - Imported (xpriv): the imported xpriv is the BIP-32 root, so `leafPath`
 *   is relative (e.g. `0/0`).
 *
 * Caller resolves and pins `leafPath` from canonical account state; we
 * validate defensively.
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
    // HD leafPath is master-rooted (`m/<purpose>'/<coin>'/<account>'/<change>/<index>`).
    if (!leafPath.startsWith('m/')) {
      throw new OneKeyLocalError(
        'HD leafPath must be master-rooted (start with "m/")',
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
    if (!leafPath) {
      throw new OneKeyLocalError(
        'deriveContextHash requires a connected leaf BIP-32 path for imported credentials',
      );
    }
    // Imported xpriv IS the BIP-32 root, so leafPath must be relative
    // (e.g. "0/0", "0/1") — not master-rooted ("m/..."). bip32's
    // derivePath silently strips the "m/" prefix, so we fail-fast here
    // to surface caller-side bugs rather than producing a secret from a
    // semantically-wrong path.
    if (leafPath === 'm' || leafPath.startsWith('m/')) {
      throw new OneKeyLocalError(
        'Imported leafPath must be relative (must not start with "m/")',
      );
    }
    return deriveFromImported({
      importedCredential: credentials.imported,
      password,
      leafPath,
      appName,
      contextBytes,
    });
  }

  throw new OneKeyLocalError(
    'deriveContextHash requires HD or imported credentials',
  );
}
