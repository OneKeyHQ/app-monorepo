import { ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PURPOSE_EXTENSION_DATA } from '../consts/desktopNativeMessaging';
import { OneKeyLocalError } from '../errors';
import { stableStringify } from '../utils/stringUtils';

import type {
  IDesktopNativeSafeStorageChallenge,
  IDesktopNativeSafeStorageDecryptStringParams,
  IDesktopNativeSafeStorageEncryptStringParams,
  IDesktopNativeSafeStorageOwner,
  IDesktopNativeSafeStoragePublicKeyJwk,
} from './types';

const DB_NAME = 'onekey-desktop-native-messaging';
const DB_VERSION = 1;
const STORE_NAME = 'safe-storage-signing-identities';
const DEFAULT_IDENTITY_ID = 'default-p256-v1';

// The private key is stored as a browser non-extractable CryptoKey. This
// prevents direct JS export and blocks third-party extensions from signing as
// this owner, but it does not defend against code execution inside the OneKey
// extension runtime or same-user tampering with the browser profile/native
// messaging registration chain.
type IStoredSafeStorageSigningIdentity = {
  id: string;
  privateKey: CryptoKey;
  publicKeyJwk: IDesktopNativeSafeStoragePublicKeyJwk;
  createdAt: number;
};

let dbPromise: Promise<IDBDatabase> | undefined;
let identityPromise: Promise<IStoredSafeStorageSigningIdentity> | undefined;

function getCryptoSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new OneKeyLocalError('WebCrypto subtle API is unavailable');
  }
  return subtle;
}

function getIndexedDb(): IDBFactory {
  const indexedDb = globalThis.indexedDB;
  if (!indexedDb) {
    throw new OneKeyLocalError('IndexedDB is unavailable');
  }
  return indexedDb;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...byteArray]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await getCryptoSubtle().digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToHex(digest);
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function normalizePublicKeyJwk(
  publicKeyJwk: JsonWebKey,
): IDesktopNativeSafeStoragePublicKeyJwk {
  if (
    publicKeyJwk.kty !== 'EC' ||
    publicKeyJwk.crv !== 'P-256' ||
    typeof publicKeyJwk.x !== 'string' ||
    typeof publicKeyJwk.y !== 'string'
  ) {
    throw new OneKeyLocalError('Unsupported safeStorage signing public key');
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: publicKeyJwk.x,
    y: publicKeyJwk.y,
  };
}

function isStoredSafeStorageSigningIdentity(
  value: unknown,
): value is IStoredSafeStorageSigningIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const identity = value as Partial<IStoredSafeStorageSigningIdentity>;
  return (
    identity.id === DEFAULT_IDENTITY_ID &&
    identity.privateKey?.type === 'private' &&
    identity.privateKey.extractable === false &&
    identity.publicKeyJwk?.kty === 'EC' &&
    identity.publicKeyJwk.crv === 'P-256' &&
    typeof identity.publicKeyJwk.x === 'string' &&
    typeof identity.publicKeyJwk.y === 'string'
  );
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = getIndexedDb().open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // Don't cache a rejected promise (e.g. IndexedDB transiently unavailable):
  // reset so the next call can retry instead of failing forever.
  pending.catch(() => {
    if (dbPromise === pending) {
      dbPromise = undefined;
    }
  });
  dbPromise = pending;
  return pending;
}

async function readStoredIdentity(): Promise<
  IStoredSafeStorageSigningIdentity | undefined
> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(DEFAULT_IDENTITY_ID);
    request.onsuccess = () => {
      const value = request.result as unknown;
      resolve(isStoredSafeStorageSigningIdentity(value) ? value : undefined);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeStoredIdentity(
  identity: IStoredSafeStorageSigningIdentity,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(identity);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function generateSigningIdentity(params?: {
  persist?: boolean;
}): Promise<IStoredSafeStorageSigningIdentity> {
  const keyPair = await getCryptoSubtle().generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign', 'verify'],
  );
  const publicKeyJwk = normalizePublicKeyJwk(
    await getCryptoSubtle().exportKey('jwk', keyPair.publicKey),
  );
  const identity = {
    id: DEFAULT_IDENTITY_ID,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
    createdAt: Date.now(),
  };
  if (params?.persist ?? true) {
    await writeStoredIdentity(identity);
  }
  return identity;
}

async function getOrCreateSigningIdentity(): Promise<IStoredSafeStorageSigningIdentity> {
  if (identityPromise) {
    return identityPromise;
  }
  const pending = (async () => {
    const storedIdentity = await readStoredIdentity();
    return storedIdentity ?? generateSigningIdentity({ persist: true });
  })();
  // Don't cache a rejected promise: reset so the next call can retry instead of
  // failing forever.
  pending.catch(() => {
    if (identityPromise === pending) {
      identityPromise = undefined;
    }
  });
  identityPromise = pending;
  return pending;
}

async function getPublicKeyHash(
  publicKeyJwk: IDesktopNativeSafeStoragePublicKeyJwk,
): Promise<string> {
  return sha256Hex(stableStringify(publicKeyJwk));
}

async function signChallenge(
  privateKey: CryptoKey,
  challenge: IDesktopNativeSafeStorageChallenge,
): Promise<string> {
  const signature = await getCryptoSubtle().sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    privateKey,
    new TextEncoder().encode(stableStringify(challenge)),
  );
  return bytesToHex(signature);
}

async function createOwner(
  extensionId: string,
  options?: { ephemeralIdentity?: boolean },
): Promise<{
  identity: IStoredSafeStorageSigningIdentity;
  owner: IDesktopNativeSafeStorageOwner;
}> {
  const identity = options?.ephemeralIdentity
    ? await generateSigningIdentity({ persist: false })
    : await getOrCreateSigningIdentity();
  const publicKeyHash = await getPublicKeyHash(identity.publicKeyJwk);
  return {
    identity,
    owner: {
      extensionId,
      clientId: publicKeyHash,
      publicKeyHash,
    },
  };
}

async function createSafeStorageAuth(params: {
  extensionId: string;
  method: IDesktopNativeSafeStorageChallenge['method'];
  purpose: string;
  valueHash?: string;
  encryptedTextHash?: string;
  ephemeralIdentity?: boolean;
}) {
  const { identity, owner } = await createOwner(params.extensionId, {
    ephemeralIdentity: params.ephemeralIdentity,
  });
  const challenge: IDesktopNativeSafeStorageChallenge = {
    version: 1,
    method: params.method,
    purpose: params.purpose,
    owner,
    timestamp: Date.now(),
    nonce: randomHex(16),
    ...(params.valueHash ? { valueHash: params.valueHash } : undefined),
    ...(params.encryptedTextHash
      ? { encryptedTextHash: params.encryptedTextHash }
      : undefined),
  };
  return {
    publicKeyJwk: identity.publicKeyJwk,
    challenge,
    signature: await signChallenge(identity.privateKey, challenge),
  };
}

export async function buildSafeStorageEncryptStringParams(params: {
  extensionId: string;
  value: string;
  purpose?: string;
}): Promise<IDesktopNativeSafeStorageEncryptStringParams> {
  const purpose =
    params.purpose ??
    ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PURPOSE_EXTENSION_DATA;
  return {
    purpose,
    value: params.value,
    auth: await createSafeStorageAuth({
      extensionId: params.extensionId,
      method: 'safeStorageEncryptString',
      purpose,
      valueHash: await sha256Hex(params.value),
    }),
  };
}

async function buildDecryptStringParams(
  params: {
    extensionId: string;
    encryptedText: string;
    purpose?: string;
  },
  options?: { ephemeralIdentity?: boolean },
): Promise<IDesktopNativeSafeStorageDecryptStringParams> {
  const purpose =
    params.purpose ??
    ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PURPOSE_EXTENSION_DATA;
  return {
    purpose,
    encryptedText: params.encryptedText,
    auth: await createSafeStorageAuth({
      extensionId: params.extensionId,
      method: 'safeStorageDecryptString',
      purpose,
      encryptedTextHash: await sha256Hex(params.encryptedText),
      ephemeralIdentity: options?.ephemeralIdentity,
    }),
  };
}

export async function buildSafeStorageDecryptStringParams(params: {
  extensionId: string;
  encryptedText: string;
  purpose?: string;
}): Promise<IDesktopNativeSafeStorageDecryptStringParams> {
  return buildDecryptStringParams(params);
}

export async function buildSafeStorageDecryptStringParamsWithEphemeralIdentityForDevSettings(params: {
  extensionId: string;
  encryptedText: string;
  purpose?: string;
}): Promise<IDesktopNativeSafeStorageDecryptStringParams> {
  return buildDecryptStringParams(params, { ephemeralIdentity: true });
}
