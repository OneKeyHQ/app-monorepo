import { decodePasswordAsync } from '@onekeyhq/core/src/secret';
import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  defaultRandomBytes,
  deleteCryptoKeyRecord,
  getCryptoGlobal,
  getOrCreateCryptoKey,
  toWebCryptoBytes,
} from '@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';

export const HYPERLIQUID_AGENT_PASSWORD_ENCRYPTED_PREFIX = '|HLE|';

const HYPERLIQUID_AGENT_SECRET_VERSION = 1;
const HYPERLIQUID_AGENT_SECRET_KEY_BITS = 256;
const HYPERLIQUID_AGENT_SECRET_NONCE_BYTES = 12;
// This is part of the HLE v1 storage protocol. Changing it in place would
// derive a different key and orphan existing credentials; use a new format
// version and an explicit migration for future KDF upgrades.
const HYPERLIQUID_AGENT_SECRET_KDF_ITERATIONS = 600_000;
const HYPERLIQUID_AGENT_SESSION_STORAGE_KEY =
  'onekey_hyperliquid_agent_session_v1';
const HYPERLIQUID_AGENT_SESSION_WRAP_KEY_REF =
  'onekey:hyperliquid-agent-session-wrap:v1';

type IHyperLiquidAgentEncryptedPayload = {
  algorithm: 'AES-256-GCM';
  ciphertext: string;
  iv: string;
  version: 1;
};

type IHyperLiquidAgentSessionPayload = {
  ciphertext: string;
  iv: string;
  unlocked: boolean;
  version: 1;
};

type IHyperLiquidAgentDerivedKey = {
  key: CryptoKey;
  rawKey: Uint8Array<ArrayBuffer>;
};

function buildCredentialAad(recordId: string): Uint8Array<ArrayBuffer> {
  return toWebCryptoBytes(
    bufferUtils.utf8ToBytes(
      stringUtils.stableStringify({
        purpose: 'onekey-hyperliquid-agent-credential',
        recordId,
        version: HYPERLIQUID_AGENT_SECRET_VERSION,
      }),
    ),
  );
}

function buildSessionWrapAad(): Uint8Array<ArrayBuffer> {
  return toWebCryptoBytes(
    bufferUtils.utf8ToBytes(
      stringUtils.stableStringify({
        purpose: 'onekey-hyperliquid-agent-session',
        version: HYPERLIQUID_AGENT_SECRET_VERSION,
      }),
    ),
  );
}

async function buildPasswordDerivationSalt(): Promise<Uint8Array<ArrayBuffer>> {
  const { sensitiveEncodeKey } = await settingsPersistAtom.get();
  if (!sensitiveEncodeKey) {
    throw new OneKeyLocalError(
      'HyperLiquid agent password derivation salt is unavailable',
    );
  }
  const cryptoGlobal = getCryptoGlobal();
  const digest = await cryptoGlobal.subtle.digest(
    'SHA-256',
    toWebCryptoBytes(
      bufferUtils.utf8ToBytes(
        stringUtils.stableStringify({
          purpose: 'onekey-hyperliquid-agent-password-salt',
          sensitiveEncodeKey,
          version: HYPERLIQUID_AGENT_SECRET_VERSION,
        }),
      ),
    ),
  );
  return new Uint8Array(digest);
}

async function importHyperLiquidAgentSecretKey(
  rawKey: Uint8Array,
): Promise<CryptoKey> {
  return getCryptoGlobal().subtle.importKey(
    'raw',
    toWebCryptoBytes(rawKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveHyperLiquidAgentSecretKey({
  password,
}: {
  password: string;
}): Promise<IHyperLiquidAgentDerivedKey> {
  const decodedPassword = await decodePasswordAsync({ password });
  const passwordBytes = toWebCryptoBytes(
    bufferUtils.utf8ToBytes(decodedPassword),
  );
  const cryptoGlobal = getCryptoGlobal();
  try {
    const baseKey = await cryptoGlobal.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const derivedBits = await cryptoGlobal.subtle.deriveBits(
      {
        hash: 'SHA-256',
        iterations: HYPERLIQUID_AGENT_SECRET_KDF_ITERATIONS,
        name: 'PBKDF2',
        salt: await buildPasswordDerivationSalt(),
      },
      baseKey,
      HYPERLIQUID_AGENT_SECRET_KEY_BITS,
    );
    const rawKey = new Uint8Array(derivedBits);
    return {
      key: await importHyperLiquidAgentSecretKey(rawKey),
      rawKey,
    };
  } finally {
    passwordBytes.fill(0);
  }
}

export function isHyperLiquidAgentPasswordEncryptedCredential(
  credential: string,
): boolean {
  return credential.startsWith(HYPERLIQUID_AGENT_PASSWORD_ENCRYPTED_PREFIX);
}

export async function encryptHyperLiquidAgentCredentialWithSessionKey({
  credential,
  key,
  recordId,
}: {
  credential: ICoreHyperLiquidAgentCredential;
  key: CryptoKey;
  recordId: string;
}): Promise<string> {
  if (!credential?.privateKey || !recordId) {
    throw new OneKeyLocalError('Invalid HyperLiquid agent credential');
  }
  const cryptoGlobal = getCryptoGlobal();
  const iv = toWebCryptoBytes(
    defaultRandomBytes(HYPERLIQUID_AGENT_SECRET_NONCE_BYTES),
  );
  const plaintext = toWebCryptoBytes(
    bufferUtils.utf8ToBytes(stringUtils.stableStringify(credential)),
  );
  try {
    const ciphertext = await cryptoGlobal.subtle.encrypt(
      {
        additionalData: buildCredentialAad(recordId),
        iv,
        name: 'AES-GCM',
      },
      key,
      plaintext,
    );
    const payload: IHyperLiquidAgentEncryptedPayload = {
      algorithm: 'AES-256-GCM',
      ciphertext: bufferUtils.bytesToBase64(new Uint8Array(ciphertext)),
      iv: bufferUtils.bytesToBase64(iv),
      version: HYPERLIQUID_AGENT_SECRET_VERSION,
    };
    return `${HYPERLIQUID_AGENT_PASSWORD_ENCRYPTED_PREFIX}${stringUtils.stableStringify(
      payload,
    )}`;
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptHyperLiquidAgentCredentialWithSessionKey({
  credential,
  key,
  recordId,
}: {
  credential: string;
  key: CryptoKey;
  recordId: string;
}): Promise<ICoreHyperLiquidAgentCredential> {
  if (!isHyperLiquidAgentPasswordEncryptedCredential(credential)) {
    throw new OneKeyLocalError(
      'Unsupported HyperLiquid agent credential format',
    );
  }
  let payload: IHyperLiquidAgentEncryptedPayload;
  try {
    payload = JSON.parse(
      credential.slice(HYPERLIQUID_AGENT_PASSWORD_ENCRYPTED_PREFIX.length),
    ) as IHyperLiquidAgentEncryptedPayload;
  } catch {
    throw new OneKeyLocalError('Invalid HyperLiquid agent credential payload');
  }
  if (
    payload.version !== HYPERLIQUID_AGENT_SECRET_VERSION ||
    payload.algorithm !== 'AES-256-GCM' ||
    !payload.iv ||
    !payload.ciphertext
  ) {
    throw new OneKeyLocalError('Invalid HyperLiquid agent credential payload');
  }
  const plaintext = await getCryptoGlobal().subtle.decrypt(
    {
      additionalData: buildCredentialAad(recordId),
      iv: toWebCryptoBytes(bufferUtils.base64ToBytes(payload.iv)),
      name: 'AES-GCM',
    },
    key,
    toWebCryptoBytes(bufferUtils.base64ToBytes(payload.ciphertext)),
  );
  const plaintextBytes = new Uint8Array(plaintext);
  try {
    const result = JSON.parse(
      bufferUtils.bytesToUtf8(plaintextBytes, { checkIsValidUtf8: true }),
    ) as ICoreHyperLiquidAgentCredential;
    if (
      !result?.privateKey ||
      accountUtils.buildHyperLiquidAgentCredentialId({
        agentName: result.agentName,
        userAddress: result.userAddress,
      }) !== recordId
    ) {
      throw new OneKeyLocalError('Invalid HyperLiquid agent credential');
    }
    return result;
  } finally {
    plaintextBytes.fill(0);
  }
}

function getExtensionSessionStorage() {
  return globalThis.chrome?.storage?.session;
}

function isRestorableSessionPlatform(): boolean {
  return Boolean(platformEnv.isExtension || platformEnv.isDesktop);
}

async function getPersistedSessionPayload(): Promise<
  IHyperLiquidAgentSessionPayload | undefined
> {
  if (platformEnv.isExtension) {
    const stored = await getExtensionSessionStorage()?.get(
      HYPERLIQUID_AGENT_SESSION_STORAGE_KEY,
    );
    return stored?.[HYPERLIQUID_AGENT_SESSION_STORAGE_KEY] as
      | IHyperLiquidAgentSessionPayload
      | undefined;
  }
  if (platformEnv.isDesktop) {
    return globalThis.desktopApiProxy?.security.getHyperLiquidAgentSession();
  }
  return undefined;
}

async function setPersistedSessionPayload(
  payload: IHyperLiquidAgentSessionPayload,
): Promise<void> {
  if (platformEnv.isExtension) {
    const storage = getExtensionSessionStorage();
    if (!storage) {
      throw new OneKeyLocalError(
        'Extension session storage is unavailable for HyperLiquid agent key',
      );
    }
    await storage.set({
      [HYPERLIQUID_AGENT_SESSION_STORAGE_KEY]: payload,
    });
    return;
  }
  if (platformEnv.isDesktop) {
    const securityApi = globalThis.desktopApiProxy?.security;
    if (!securityApi) {
      throw new OneKeyLocalError(
        'Desktop process session is unavailable for HyperLiquid agent key',
      );
    }
    await securityApi.setHyperLiquidAgentSession(payload);
  }
}

async function removePersistedSessionPayload(): Promise<void> {
  if (platformEnv.isExtension) {
    const storage = getExtensionSessionStorage();
    if (!storage) {
      throw new OneKeyLocalError(
        'Extension session storage is unavailable for HyperLiquid agent key',
      );
    }
    await storage.remove(HYPERLIQUID_AGENT_SESSION_STORAGE_KEY);
  } else if (platformEnv.isDesktop) {
    const securityApi = globalThis.desktopApiProxy?.security;
    if (!securityApi) {
      throw new OneKeyLocalError(
        'Desktop process session is unavailable for HyperLiquid agent key',
      );
    }
    await securityApi.clearHyperLiquidAgentSession();
  }
}

async function invalidatePersistedSession(): Promise<void> {
  const [wrappingKeyDeletion] = await Promise.allSettled([
    deleteCryptoKeyRecord({
      keyRef: HYPERLIQUID_AGENT_SESSION_WRAP_KEY_REF,
    }),
    removePersistedSessionPayload(),
  ]);
  if (wrappingKeyDeletion.status === 'rejected') {
    throw new OneKeyLocalError(
      'HyperLiquid agent session wrapping key invalidation failed',
    );
  }
}

export class HyperLiquidAgentSecretSession {
  private key: CryptoKey | undefined;

  private operationGeneration = 0;

  private operationTail: Promise<void> = Promise.resolve();

  private restorePromise:
    | Promise<{ restored: boolean; unlocked: boolean }>
    | undefined;

  isReady(): boolean {
    return Boolean(this.key);
  }

  async unlock({ password }: { password: string }): Promise<void> {
    const operationGeneration = this.advanceOperationGeneration();
    this.key = undefined;
    await this.runSessionOperation(async () => {
      let persistedSessionWasUnlocked = false;
      if (isRestorableSessionPlatform()) {
        try {
          const currentPayload = await getPersistedSessionPayload();
          persistedSessionWasUnlocked = currentPayload?.unlocked === true;
        } finally {
          // Destroying the wrapping key makes an older payload unrecoverable
          // even if a renderer/worker exits before payload cleanup finishes.
          await invalidatePersistedSession();
        }
      }
      const derived = await deriveHyperLiquidAgentSecretKey({ password });
      try {
        this.ensureOperationIsCurrent(operationGeneration);
        this.key = derived.key;
        if (isRestorableSessionPlatform()) {
          try {
            await this.persistSessionKey({
              operationGeneration,
              rawKey: derived.rawKey,
              unlocked: persistedSessionWasUnlocked,
            });
            this.ensureOperationIsCurrent(operationGeneration);
          } catch (error) {
            // A failed replacement remains usable only in this runtime. Its
            // wrapping key/payload must not survive a renderer/worker reload.
            try {
              await invalidatePersistedSession();
            } catch {
              // Preserve the original persistence error.
            }
            throw error;
          }
        }
      } finally {
        derived.rawKey.fill(0);
      }
    });
  }

  async encryptCredential({
    credential,
    recordId,
  }: {
    credential: ICoreHyperLiquidAgentCredential;
    recordId: string;
  }): Promise<string> {
    const key = await this.getKeyOrThrow();
    return encryptHyperLiquidAgentCredentialWithSessionKey({
      credential,
      key,
      recordId,
    });
  }

  async decryptCredential({
    credential,
    recordId,
  }: {
    credential: string;
    recordId: string;
  }): Promise<ICoreHyperLiquidAgentCredential> {
    const key = await this.getKeyOrThrow();
    return decryptHyperLiquidAgentCredentialWithSessionKey({
      credential,
      key,
      recordId,
    });
  }

  async restorePersistedSession(): Promise<{
    restored: boolean;
    unlocked: boolean;
  }> {
    if (!isRestorableSessionPlatform()) {
      return { restored: false, unlocked: false };
    }
    if (!this.restorePromise) {
      const operationGeneration = this.operationGeneration;
      this.restorePromise = this.runSessionOperation(() =>
        this.restorePersistedSessionInternal({ operationGeneration }),
      );
    }
    try {
      return await this.restorePromise;
    } finally {
      this.restorePromise = undefined;
    }
  }

  async setPersistedSessionUnlocked(unlocked: boolean): Promise<void> {
    if (!isRestorableSessionPlatform()) {
      return;
    }
    await this.runSessionOperation(async () => {
      const payload = await getPersistedSessionPayload();
      if (payload?.version !== HYPERLIQUID_AGENT_SECRET_VERSION) {
        return;
      }
      await setPersistedSessionPayload({
        ...payload,
        unlocked,
      });
    });
  }

  async clear(): Promise<void> {
    this.advanceOperationGeneration();
    this.key = undefined;
    const earlyInvalidation = isRestorableSessionPlatform()
      ? invalidatePersistedSession().catch(() => undefined)
      : Promise.resolve();
    await this.runSessionOperation(async () => {
      await earlyInvalidation;
      if (isRestorableSessionPlatform()) {
        // Sweep again after older queued operations finish in case one created
        // a replacement wrapping key before observing the generation change.
        await invalidatePersistedSession();
      }
    });
  }

  private async getKeyOrThrow(): Promise<CryptoKey> {
    if (!this.key && isRestorableSessionPlatform()) {
      await this.restorePersistedSession();
    }
    if (!this.key) {
      throw new OneKeyLocalError(
        'HyperLiquid agent secret session is unavailable; unlock the app again',
      );
    }
    return this.key;
  }

  private async persistSessionKey({
    operationGeneration,
    rawKey,
    unlocked,
  }: {
    operationGeneration: number;
    rawKey: Uint8Array;
    unlocked: boolean;
  }): Promise<void> {
    const wrappingKey = await getOrCreateCryptoKey({
      keyRef: HYPERLIQUID_AGENT_SESSION_WRAP_KEY_REF,
    });
    this.ensureOperationIsCurrent(operationGeneration);
    const iv = toWebCryptoBytes(
      defaultRandomBytes(HYPERLIQUID_AGENT_SECRET_NONCE_BYTES),
    );
    const ciphertext = await getCryptoGlobal().subtle.encrypt(
      {
        additionalData: buildSessionWrapAad(),
        iv,
        name: 'AES-GCM',
      },
      wrappingKey,
      toWebCryptoBytes(rawKey),
    );
    this.ensureOperationIsCurrent(operationGeneration);
    await setPersistedSessionPayload({
      ciphertext: bufferUtils.bytesToBase64(new Uint8Array(ciphertext)),
      iv: bufferUtils.bytesToBase64(iv),
      unlocked,
      version: HYPERLIQUID_AGENT_SECRET_VERSION,
    });
  }

  private advanceOperationGeneration(): number {
    this.operationGeneration += 1;
    return this.operationGeneration;
  }

  private ensureOperationIsCurrent(operationGeneration: number): void {
    if (operationGeneration !== this.operationGeneration) {
      throw new OneKeyLocalError(
        'HyperLiquid agent session operation was superseded',
      );
    }
  }

  private async runSessionOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const previousOperation = this.operationTail;
    let completeOperation: () => void = () => undefined;
    this.operationTail = new Promise<void>((resolve) => {
      completeOperation = resolve;
    });
    await previousOperation;
    try {
      return await operation();
    } finally {
      completeOperation();
    }
  }

  private async restorePersistedSessionInternal({
    operationGeneration,
  }: {
    operationGeneration: number;
  }): Promise<{
    restored: boolean;
    unlocked: boolean;
  }> {
    const payload = await getPersistedSessionPayload();
    if (
      payload?.version !== HYPERLIQUID_AGENT_SECRET_VERSION ||
      !payload.iv ||
      !payload.ciphertext ||
      payload.unlocked !== true
    ) {
      return { restored: false, unlocked: false };
    }
    try {
      const wrappingKey = await getOrCreateCryptoKey({
        keyRef: HYPERLIQUID_AGENT_SESSION_WRAP_KEY_REF,
      });
      const rawKey = await getCryptoGlobal().subtle.decrypt(
        {
          additionalData: buildSessionWrapAad(),
          iv: toWebCryptoBytes(bufferUtils.base64ToBytes(payload.iv)),
          name: 'AES-GCM',
        },
        wrappingKey,
        toWebCryptoBytes(bufferUtils.base64ToBytes(payload.ciphertext)),
      );
      const rawKeyBytes = new Uint8Array(rawKey);
      try {
        const restoredKey = await importHyperLiquidAgentSecretKey(rawKeyBytes);
        if (operationGeneration !== this.operationGeneration) {
          return { restored: false, unlocked: false };
        }
        this.key = restoredKey;
      } finally {
        rawKeyBytes.fill(0);
      }
      return { restored: true, unlocked: payload.unlocked === true };
    } catch {
      await removePersistedSessionPayload();
      this.key = undefined;
      return { restored: false, unlocked: false };
    }
  }
}

export const hyperLiquidAgentSecretSession =
  new HyperLiquidAgentSecretSession();
