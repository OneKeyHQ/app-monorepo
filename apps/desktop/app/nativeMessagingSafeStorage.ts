import { createHash, webcrypto } from 'crypto';

import { safeStorage } from 'electron';

import {
  ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_ALLOWED_PURPOSES,
  ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_MAX_VALUE_BYTES,
  ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PREFIX,
} from '@onekeyhq/shared/src/consts/desktopNativeMessaging';
import type {
  IDesktopNativeMessagingErrorCode,
  IDesktopNativeSafeStorageAuth,
  IDesktopNativeSafeStorageChallenge,
  IDesktopNativeSafeStorageDecryptStringParams,
  IDesktopNativeSafeStorageEncryptStringParams,
  IDesktopNativeSafeStorageEnvelope,
  IDesktopNativeSafeStorageOwner,
  IDesktopNativeSafeStoragePublicKeyJwk,
} from '@onekeyhq/shared/src/desktopNativeMessaging/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

type IDesktopSafeStorageNativeErrorCode = Extract<
  IDesktopNativeMessagingErrorCode,
  | 'BAD_REQUEST'
  | 'OWNER_AUTH_FAILED'
  | 'SAFE_STORAGE_DECRYPT_FAILED'
  | 'SAFE_STORAGE_UNAVAILABLE'
  | 'SAFE_STORAGE_VALUE_TOO_LARGE'
>;

const SAFE_STORAGE_AUTH_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const SAFE_STORAGE_NONCE_PATTERN = /^[0-9a-f]{32,128}$/i;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;
const LINUX_SAFE_STORAGE_BACKENDS = new Set([
  'gnome_libsecret',
  'kwallet',
  'kwallet5',
  'kwallet6',
]);

export class DesktopSafeStorageNativeError extends OneKeyLocalError {
  readonly errorCode: IDesktopSafeStorageNativeErrorCode;

  constructor(errorCode: IDesktopSafeStorageNativeErrorCode) {
    super(errorCode);
    this.errorCode = errorCode;
  }
}

export function isDesktopSafeStorageAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }

  // Electron's Linux basic_text backend uses a hardcoded password instead of a
  // real OS secret store. Fail closed on Linux and only allow reviewed secret
  // store backends; "unknown" or future backends should be reviewed first.
  if (process.platform === 'linux') {
    try {
      return LINUX_SAFE_STORAGE_BACKENDS.has(
        safeStorage.getSelectedStorageBackend(),
      );
    } catch {
      return false;
    }
  }

  return true;
}

function ensureDesktopSafeStorageAvailable() {
  if (!isDesktopSafeStorageAvailable()) {
    throw new DesktopSafeStorageNativeError('SAFE_STORAGE_UNAVAILABLE');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRequiredString(
  record: Record<string, unknown>,
  name: string,
): string {
  const value = record[name];
  if (typeof value !== 'string' || !value) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  return value;
}

function getString(record: Record<string, unknown>, name: string): string {
  const value = record[name];
  if (typeof value !== 'string') {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  return value;
}

function getRequiredNumber(
  record: Record<string, unknown>,
  name: string,
): number {
  const value = record[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  return value;
}

function ensureAllowedPurpose(purpose: string) {
  if (
    !ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_ALLOWED_PURPOSES.includes(
      purpose as (typeof ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_ALLOWED_PURPOSES)[number],
    )
  ) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizePublicKeyJwk(
  publicKeyJwk: unknown,
): IDesktopNativeSafeStoragePublicKeyJwk {
  if (!isRecord(publicKeyJwk)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }

  const normalizedPublicKeyJwk = {
    kty: getRequiredString(publicKeyJwk, 'kty'),
    crv: getRequiredString(publicKeyJwk, 'crv'),
    x: getRequiredString(publicKeyJwk, 'x'),
    y: getRequiredString(publicKeyJwk, 'y'),
  };

  if (
    normalizedPublicKeyJwk.kty !== 'EC' ||
    normalizedPublicKeyJwk.crv !== 'P-256'
  ) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }

  return normalizedPublicKeyJwk as IDesktopNativeSafeStoragePublicKeyJwk;
}

function getPublicKeyHash(
  publicKeyJwk: IDesktopNativeSafeStoragePublicKeyJwk,
): string {
  return sha256Hex(stableStringify(publicKeyJwk));
}

function parseOwner(owner: unknown): IDesktopNativeSafeStorageOwner {
  if (!isRecord(owner)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  return {
    extensionId: getRequiredString(owner, 'extensionId'),
    clientId: getRequiredString(owner, 'clientId'),
    publicKeyHash: getRequiredString(owner, 'publicKeyHash'),
  };
}

function parseChallenge(
  challenge: unknown,
): IDesktopNativeSafeStorageChallenge {
  if (!isRecord(challenge)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }

  const version = getRequiredNumber(challenge, 'version');
  if (version !== 1) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }

  const method = getRequiredString(challenge, 'method');
  if (
    method !== 'safeStorageEncryptString' &&
    method !== 'safeStorageDecryptString'
  ) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }

  const valueHash = challenge.valueHash;
  const encryptedTextHash = challenge.encryptedTextHash;

  return {
    version,
    method,
    purpose: getRequiredString(challenge, 'purpose'),
    owner: parseOwner(challenge.owner),
    timestamp: getRequiredNumber(challenge, 'timestamp'),
    nonce: getRequiredString(challenge, 'nonce'),
    ...(typeof valueHash === 'string' ? { valueHash } : undefined),
    ...(typeof encryptedTextHash === 'string'
      ? { encryptedTextHash }
      : undefined),
  };
}

function parseAuth(auth: unknown): IDesktopNativeSafeStorageAuth {
  if (!isRecord(auth)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  return {
    publicKeyJwk: normalizePublicKeyJwk(auth.publicKeyJwk),
    challenge: parseChallenge(auth.challenge),
    signature: getRequiredString(auth, 'signature'),
  };
}

function buildExpectedChallenge(params: {
  method: IDesktopNativeSafeStorageChallenge['method'];
  purpose: string;
  owner: IDesktopNativeSafeStorageOwner;
  timestamp: number;
  nonce: string;
  valueHash?: string;
  encryptedTextHash?: string;
}): IDesktopNativeSafeStorageChallenge {
  return {
    version: 1,
    method: params.method,
    purpose: params.purpose,
    owner: params.owner,
    timestamp: params.timestamp,
    nonce: params.nonce,
    ...(params.valueHash ? { valueHash: params.valueHash } : undefined),
    ...(params.encryptedTextHash
      ? { encryptedTextHash: params.encryptedTextHash }
      : undefined),
  };
}

async function verifyAuth(params: {
  auth: unknown;
  callerExtensionId: string;
  method: IDesktopNativeSafeStorageChallenge['method'];
  purpose: string;
  valueHash?: string;
  encryptedTextHash?: string;
}): Promise<IDesktopNativeSafeStorageOwner> {
  const auth = parseAuth(params.auth);
  const { challenge } = auth;
  const publicKeyHash = getPublicKeyHash(auth.publicKeyJwk);

  ensureAllowedPurpose(params.purpose);

  if (
    challenge.method !== params.method ||
    challenge.purpose !== params.purpose ||
    challenge.owner.extensionId !== params.callerExtensionId ||
    challenge.owner.clientId !== publicKeyHash ||
    challenge.owner.publicKeyHash !== publicKeyHash ||
    (params.valueHash && challenge.valueHash !== params.valueHash) ||
    (params.encryptedTextHash &&
      challenge.encryptedTextHash !== params.encryptedTextHash) ||
    (!params.valueHash && challenge.valueHash !== undefined) ||
    (!params.encryptedTextHash && challenge.encryptedTextHash !== undefined)
  ) {
    throw new DesktopSafeStorageNativeError('OWNER_AUTH_FAILED');
  }

  // The host is stateless, so this timestamp check limits stale signed
  // requests but does not provide replay protection for a captured request
  // inside the tolerance window. Add a host-issued challenge or nonce cache
  // before expanding this protocol to more sensitive methods.
  const now = Date.now();
  if (
    Math.abs(now - challenge.timestamp) >
      SAFE_STORAGE_AUTH_TIMESTAMP_TOLERANCE_MS ||
    !SAFE_STORAGE_NONCE_PATTERN.test(challenge.nonce)
  ) {
    throw new DesktopSafeStorageNativeError('OWNER_AUTH_FAILED');
  }

  const expectedChallenge = buildExpectedChallenge({
    method: params.method,
    purpose: params.purpose,
    owner: challenge.owner,
    timestamp: challenge.timestamp,
    nonce: challenge.nonce,
    valueHash: params.valueHash,
    encryptedTextHash: params.encryptedTextHash,
  });

  const signedPayload = stableStringify(expectedChallenge);
  if (stableStringify(challenge) !== signedPayload) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  if (!HEX_PATTERN.test(auth.signature)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }

  let verified = false;
  try {
    const publicKey = await webcrypto.subtle.importKey(
      'jwk',
      {
        ...auth.publicKeyJwk,
        ext: true,
        key_ops: ['verify'],
      },
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify'],
    );
    verified = await webcrypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      publicKey,
      Buffer.from(auth.signature, 'hex'),
      Buffer.from(signedPayload, 'utf8'),
    );
  } catch {
    throw new DesktopSafeStorageNativeError('OWNER_AUTH_FAILED');
  }
  if (!verified) {
    throw new DesktopSafeStorageNativeError('OWNER_AUTH_FAILED');
  }

  return challenge.owner;
}

function getEncryptedHex(encryptedText: string): string {
  if (
    !encryptedText.startsWith(
      ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PREFIX,
    )
  ) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  const encryptedHex = encryptedText.slice(
    ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PREFIX.length,
  );
  if (!HEX_PATTERN.test(encryptedHex)) {
    throw new DesktopSafeStorageNativeError('BAD_REQUEST');
  }
  return encryptedHex;
}

function parseEnvelope(
  envelopeText: string,
): IDesktopNativeSafeStorageEnvelope {
  let envelope: unknown;
  try {
    envelope = JSON.parse(envelopeText);
  } catch {
    throw new DesktopSafeStorageNativeError('SAFE_STORAGE_DECRYPT_FAILED');
  }
  if (!isRecord(envelope)) {
    throw new DesktopSafeStorageNativeError('SAFE_STORAGE_DECRYPT_FAILED');
  }
  const version = getRequiredNumber(envelope, 'version');
  if (version !== 1) {
    throw new DesktopSafeStorageNativeError('SAFE_STORAGE_DECRYPT_FAILED');
  }
  const purpose = getRequiredString(envelope, 'purpose');
  ensureAllowedPurpose(purpose);
  return {
    version,
    purpose,
    owner: parseOwner(envelope.owner),
    value: getString(envelope, 'value'),
  };
}

function ensureSameOwner(
  ownerA: IDesktopNativeSafeStorageOwner,
  ownerB: IDesktopNativeSafeStorageOwner,
) {
  if (
    ownerA.extensionId !== ownerB.extensionId ||
    ownerA.clientId !== ownerB.clientId ||
    ownerA.publicKeyHash !== ownerB.publicKeyHash
  ) {
    throw new DesktopSafeStorageNativeError('OWNER_AUTH_FAILED');
  }
}

export async function encryptDesktopSafeStorageString(
  params: IDesktopNativeSafeStorageEncryptStringParams,
  context: { callerExtensionId: string },
): Promise<string> {
  ensureDesktopSafeStorageAvailable();
  ensureAllowedPurpose(params.purpose);
  // Reject oversized plaintext early: the hex-encoded ciphertext response would
  // otherwise exceed Chrome's 1MB host->extension Native Messaging limit and be
  // silently dropped, leaving the caller with an opaque failure.
  if (
    Buffer.byteLength(params.value, 'utf8') >
    ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_MAX_VALUE_BYTES
  ) {
    throw new DesktopSafeStorageNativeError('SAFE_STORAGE_VALUE_TOO_LARGE');
  }
  const owner = await verifyAuth({
    auth: params.auth,
    callerExtensionId: context.callerExtensionId,
    method: 'safeStorageEncryptString',
    purpose: params.purpose,
    valueHash: sha256Hex(params.value),
  });
  const envelope: IDesktopNativeSafeStorageEnvelope = {
    version: 1,
    purpose: params.purpose,
    owner,
    value: params.value,
  };
  return `${ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PREFIX}${safeStorage
    .encryptString(stableStringify(envelope))
    .toString('hex')}`;
}

export async function decryptDesktopSafeStorageString(
  params: IDesktopNativeSafeStorageDecryptStringParams,
  context: { callerExtensionId: string },
): Promise<string> {
  ensureDesktopSafeStorageAvailable();
  ensureAllowedPurpose(params.purpose);
  const owner = await verifyAuth({
    auth: params.auth,
    callerExtensionId: context.callerExtensionId,
    method: 'safeStorageDecryptString',
    purpose: params.purpose,
    encryptedTextHash: sha256Hex(params.encryptedText),
  });
  const encryptedHex = getEncryptedHex(params.encryptedText);
  let envelopeText: string;
  try {
    envelopeText = safeStorage.decryptString(Buffer.from(encryptedHex, 'hex'));
  } catch {
    throw new DesktopSafeStorageNativeError('SAFE_STORAGE_DECRYPT_FAILED');
  }
  const envelope = parseEnvelope(envelopeText);
  if (envelope.purpose !== params.purpose) {
    throw new DesktopSafeStorageNativeError('OWNER_AUTH_FAILED');
  }
  ensureSameOwner(owner, envelope.owner);
  return envelope.value;
}
