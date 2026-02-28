/**
 * Keyless Cloud Sync Utilities
 *
 * Provides key derivation, encryption/decryption, and signing functionality for Keyless cloud sync.
 * Uses the unique Keyless wallet mnemonic to derive keys for operations.
 */

import {
  batchGetPrivateKeys,
  decryptStringAsync,
  encryptStringAsync,
  publicFromPrivate,
  sign,
} from '@onekeyhq/core/src/secret';
import {
  decryptAsync,
  encryptAsync,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import type { ICoreHdCredentialEncryptHex } from '@onekeyhq/core/src/types';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  KEYLESS_PWDHASH_CONTEXT,
  KEYLESS_PWDHASH_PREFIX,
  KEYLESS_SYNC_DERIVATION_PATH_PREFIX,
  KEYLESS_SYNC_ENCRYPTION_CONTEXT,
} from '@onekeyhq/shared/src/consts/keylessCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IKeylessCloudSyncCredential,
  IKeylessCloudSyncSignMessage,
  IKeylessCloudSyncSignaturePayload,
} from '@onekeyhq/shared/types/keylessCloudSync';

/**
 * Compute pwdHash for Keyless mode
 *
 * Format: `keyless-{sha512(context:encryptionKey)}`
 *
 * @param encryptionKey - Keyless encryption key (hex string)
 * @returns pwdHash string with 'keyless-' prefix
 */
function computeKeylessPwdHash(encryptionKey: string): string {
  const context: string = KEYLESS_PWDHASH_CONTEXT;
  const hashInput = `${context}:${encryptionKey}`;
  const hash = appCrypto.hash.sha512Sync(
    bufferUtils.toBuffer(hashInput, 'utf8'),
  );
  const prefix: string = KEYLESS_PWDHASH_PREFIX;
  return `${prefix}${bufferUtils.bytesToHex(hash)}`;
}

/**
 * Check if pwdHash is a Keyless pwdHash
 *
 * @param pwdHash - pwdHash string to check
 * @returns true if pwdHash starts with 'keyless-' prefix
 */
function isKeylessPwdHash(pwdHash: string | undefined): boolean {
  return !!pwdHash?.startsWith(KEYLESS_PWDHASH_PREFIX);
}

/**
 * Derive sync credentials from Keyless wallet
 *
 * @param hdCredential - Keyless wallet credential (from localDb.getCredential(keylessWalletId))
 * @param password - Wallet password
 * @param keylessWalletId - Keyless wallet ID
 * @returns Keyless sync credentials containing signing and encryption keys
 */
async function deriveKeylessCredential({
  hdCredential,
  password,
  keylessWalletId,
}: {
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  keylessWalletId: string;
}): Promise<IKeylessCloudSyncCredential> {
  // Batch derive private keys for two paths
  // 0/0 = signing key, 0/1 = encryption key
  const keys = await batchGetPrivateKeys(
    'secp256k1',
    hdCredential,
    password,
    KEYLESS_SYNC_DERIVATION_PATH_PREFIX, // "m/44'/38716591'/98351420'"
    ['0/0', '0/1'],
  );

  const signingKey = keys.find((k) => k.path.endsWith('0/0'));
  const encryptionKeyInfo = keys.find((k) => k.path.endsWith('0/1'));

  if (!signingKey || !encryptionKeyInfo) {
    throw new OneKeyLocalError('Failed to derive keyless sync keys');
  }

  // Derive public key from private key
  const signingPublicKey = await publicFromPrivate(
    'secp256k1',
    signingKey.extendedKey.key,
    password,
  );

  // Decrypt private keys to get deterministic hex values
  // batchGetPrivateKeys returns encrypted keys with random salt/IV,
  // so we decrypt them to ensure consistent values across sessions
  const decryptedSigningPrivateKey = await decryptAsync({
    password,
    data: signingKey.extendedKey.key,
  });

  const decryptedEncryptionKey = await decryptAsync({
    password,
    data: encryptionKeyInfo.extendedKey.key,
  });

  const encryptionKeyHex = bufferUtils.bytesToHex(decryptedEncryptionKey);

  return {
    keylessWalletId,
    signingPrivateKey: bufferUtils.bytesToHex(decryptedSigningPrivateKey),
    signingPublicKey: bufferUtils.bytesToHex(signingPublicKey),
    encryptionKey: encryptionKeyHex,
    pwdHash: computeKeylessPwdHash(encryptionKeyHex),
  };
}

/**
 * Encrypt data using Keyless derived key
 *
 * @param rawData - Raw data to encrypt (JSON string)
 * @param encryptionKey - Encryption key (hex)
 * @returns Encrypted data (hex string)
 */
async function encryptWithKeylessKey({
  rawData,
  encryptionKey,
}: {
  rawData: string;
  encryptionKey: string;
}): Promise<string> {
  // Build password using encryption key and context identifier
  const password = `${encryptionKey}:${KEYLESS_SYNC_ENCRYPTION_CONTEXT}`;
  return encryptStringAsync({
    password,
    data: rawData,
    dataEncoding: 'utf8',
    allowRawPassword: true,
  });
}

/**
 * Decrypt data using Keyless derived key
 *
 * @param encryptedData - Encrypted data (hex string)
 * @param encryptionKey - Encryption key (hex)
 * @returns Decrypted raw data (UTF8 string)
 */
async function decryptWithKeylessKey({
  encryptedData,
  encryptionKey,
}: {
  encryptedData: string;
  encryptionKey: string;
}): Promise<string> {
  const password = `${encryptionKey}:${KEYLESS_SYNC_ENCRYPTION_CONTEXT}`;
  return decryptStringAsync({
    password,
    data: encryptedData,
    dataEncoding: 'hex',
    resultEncoding: 'utf8',
    allowRawPassword: true,
  });
}

/**
 * Generate random nonce (for replay protection)
 */
function generateNonce(): string {
  const randomBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 16; i += 1) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bufferUtils.bytesToHex(randomBytes);
}

/**
 * Sign message and build Header content
 *
 * IMPORTANT: dataHash MUST be provided for all requests to ensure signature
 * is bound to the specific request payload and prevent tampering/replay attacks.
 *
 * @param signingPrivateKey - Signing private key (decrypted, hex format)
 * @param signingPublicKey - Signing public key (hex)
 * @param password - Wallet password (for encrypting private key before signing)
 * @param dataHash - SHA256 hash of request data (REQUIRED for security)
 * @returns Base64 encoded signature Header value
 */
async function buildKeylessSignatureHeader({
  signingPrivateKey,
  signingPublicKey,
  password,
  dataHash,
}: {
  signingPrivateKey: string;
  signingPublicKey: string;
  password: string;
  dataHash: string; // REQUIRED - not optional!
}): Promise<string> {
  const timestamp = Date.now();
  const nonce = generateNonce();

  // Construct sign message with dataHash to bind signature to request data
  const signMessage: IKeylessCloudSyncSignMessage = {
    timestamp,
    nonce,
    dataHash,
  };

  // Compute message hash
  // Use stableStringify to ensure consistent serialization regardless of property order
  const messageString = stringUtils.stableStringify(signMessage);
  const messageHash = appCrypto.hash.sha256Sync(
    bufferUtils.toBuffer(messageString, 'utf8'),
  );

  // Encrypt private key before signing (sign function expects encrypted key)
  const encryptedPrivateKey = await encryptAsync({
    password,
    data: bufferUtils.toBuffer(signingPrivateKey, 'hex'),
  });

  // Sign using encrypted private key
  const signature = await sign(
    'secp256k1',
    encryptedPrivateKey,
    Buffer.from(messageHash),
    password,
  );

  // Construct Header payload
  const headerPayload: IKeylessCloudSyncSignaturePayload = {
    publicKey: signingPublicKey,
    signature: bufferUtils.bytesToHex(signature),
    timestamp,
    nonce,
  };

  // Base64 encode
  return bufferUtils.bytesToBase64(
    bufferUtils.toBuffer(stringUtils.stableStringify(headerPayload), 'utf8'),
  );
}

/**
 * Compute SHA256 hash of data
 *
 * @param data - Data to hash
 * @returns Hash value (hex string)
 */
function computeDataHash(data: string): string {
  const hash = appCrypto.hash.sha256Sync(bufferUtils.toBuffer(data, 'utf8'));
  return bufferUtils.bytesToHex(hash);
}

/**
 * Parse signature Header (for server or local verification)
 *
 * @param signatureHeader - Base64 encoded signature Header
 * @returns Parsed signature payload
 */
function parseSignatureHeader(
  signatureHeader: string,
): IKeylessCloudSyncSignaturePayload | null {
  try {
    const decoded = bufferUtils.bytesToUtf8(
      bufferUtils.base64ToBytes(signatureHeader),
    );
    return JSON.parse(decoded) as IKeylessCloudSyncSignaturePayload;
  } catch {
    return null;
  }
}

export default {
  computeKeylessPwdHash,
  isKeylessPwdHash,
  deriveKeylessCredential,
  encryptWithKeylessKey,
  decryptWithKeylessKey,
  buildKeylessSignatureHeader,
  computeDataHash,
  parseSignatureHeader,
};
