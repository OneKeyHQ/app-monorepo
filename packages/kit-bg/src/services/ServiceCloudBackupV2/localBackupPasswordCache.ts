import { Mutex } from 'async-mutex';

import {
  ESecretEncryptPayloadFormat,
  decryptAsyncWithMetadata,
} from '@onekeyhq/core/src/secret';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { encryptStringAsyncWithFormat } from '../../utils/secretEncryptFormat';

// Dedicated device-only recovery material, outside all wallet/settings databases.
// This item contains only scopes, key references and authenticated ciphertext.
const MANIFEST_KEY = 'com.onekey.backup_v2.biometric_password.manifest';
const ERASURE_KEY = 'com.onekey.backup_v2.biometric_password.erasure';
const KEY_PREFIX = 'com.onekey.backup_v2.biometric_password.key.';
const DATA_TYPE = 'cloud-backup-biometric-password-v1';

type ICacheScope = {
  providerType: ECloudBackupProviderType;
  accountId: string;
  recordId?: string;
};
type ICacheEntry = { keyRef: string; ciphertext?: string };
type IManifest = { erasing?: boolean; entries: Record<string, ICacheEntry> };

function isSupported({ providerType }: ICacheScope): boolean {
  return Boolean(
    (platformEnv.isNativeIOS &&
      providerType === ECloudBackupProviderType.iCloud) ||
    (platformEnv.isNativeAndroid &&
      providerType === ECloudBackupProviderType.GoogleDrive),
  );
}

function getCacheKey({
  providerType,
  accountId,
  recordId,
}: ICacheScope): string {
  return stringUtils.stableStringify({
    providerType,
    accountId,
    recordId,
    version: 1,
  });
}

export class LocalBackupPasswordCache {
  // Only bg owns this store. No key or decrypted password survives an operation.
  private mutex = new Mutex();

  private resetting = false;

  private erasurePending = false;

  private assertPersistenceAvailable(): void {
    if (!secureStorage.isPersistenceAvailable?.()) {
      throw new OneKeyLocalError('Recovery storage unavailable');
    }
  }

  finishReset(): void {
    this.resetting = false;
  }

  private async readManifest(): Promise<IManifest> {
    this.assertPersistenceAvailable();
    const erasing =
      this.erasurePending || (await secureStorage.getSecureItem(ERASURE_KEY));
    this.assertPersistenceAvailable();
    if (erasing) this.erasurePending = true;
    const raw = await secureStorage.getSecureItem(MANIFEST_KEY);
    this.assertPersistenceAvailable();
    if (!raw) return { entries: {}, erasing: Boolean(erasing) };
    const manifest = JSON.parse(raw) as IManifest;
    if (manifest?.erasing) this.erasurePending = true;
    if (
      !manifest?.entries ||
      typeof manifest.entries !== 'object' ||
      Array.isArray(manifest.entries)
    ) {
      throw new OneKeyLocalError('Invalid recovery cache');
    }
    for (const entry of Object.values(manifest.entries)) {
      if (
        !entry ||
        typeof entry.keyRef !== 'string' ||
        !entry.keyRef.startsWith(KEY_PREFIX) ||
        !/^[0-9a-f]{64}$/.test(entry.keyRef.slice(KEY_PREFIX.length)) ||
        (entry.ciphertext !== undefined && typeof entry.ciphertext !== 'string')
      ) {
        throw new OneKeyLocalError('Invalid recovery cache');
      }
    }
    if (erasing) manifest.erasing = true;
    return manifest;
  }

  private async writeManifest(manifest: IManifest): Promise<void> {
    this.assertPersistenceAvailable();
    await secureStorage.setSecureItem(
      MANIFEST_KEY,
      stringUtils.stableStringify(manifest),
    );
    // Read only the unprotected manifest, never a protected key. This cannot
    // trigger authentication and catches a write acknowledged without persistence.
    if (
      (await secureStorage.getSecureItem(MANIFEST_KEY)) !==
      stringUtils.stableStringify(manifest)
    ) {
      throw new OneKeyLocalError('Recovery cache write failed');
    }
    this.assertPersistenceAvailable();
  }

  async get(scope: ICacheScope): Promise<string | undefined> {
    if (!isSupported(scope) || !scope.accountId || !scope.recordId)
      return undefined;
    try {
      return await this.mutex.runExclusive(async () => {
        if (this.resetting || this.erasurePending) return undefined;
        const manifest = await this.readManifest();
        if (manifest.erasing) return undefined;
        const cacheKey = getCacheKey(scope);
        const entry = manifest.entries[cacheKey];
        if (
          !entry?.ciphertext ||
          !(await secureStorage.supportSecureStorageWithBiometrics?.())
        )
          return undefined;
        // Only the explicit restore action calls get. Never probe protected keys.
        const key = await secureStorage.getSecureItemWithBiometrics?.(
          entry.keyRef,
          {
            keychainService: entry.keyRef,
            authenticationPrompt: appLocale.intl.formatMessage({
              id: ETranslations.verify_backup_password,
            }),
          },
        );
        if (!key || !/^[0-9a-f]{64}$/.test(key)) return undefined;
        const result = await decryptAsyncWithMetadata({
          data: Buffer.from(entry.ciphertext, 'hex'),
          password: key,
          allowRawPassword: true,
          aad: cacheKey,
          dataType: DATA_TYPE,
          enablePbkdf2Cache: false,
        });
        if (result.format !== ESecretEncryptPayloadFormat.v2) return undefined;
        return result.plaintext.toString('utf8') || undefined;
      });
    } catch {
      // Native/crypto exceptions can contain secrets. Do not forward or log them.
      return undefined;
    }
  }

  async set(scope: ICacheScope & { password: string }): Promise<void> {
    if (
      !isSupported(scope) ||
      !scope.accountId ||
      !scope.recordId ||
      !scope.password
    )
      return;
    try {
      await this.mutex.runExclusive(async () => {
        if (
          this.resetting ||
          this.erasurePending ||
          !(await secureStorage.supportSecureStorageWithBiometrics?.())
        )
          return;
        const manifest = await this.readManifest();
        const cacheKey = getCacheKey(scope);
        // Even a missing/invalidated key is not permission to replace a pairing.
        // Re-enabling existing entries requires a separate explicit forget flow.
        if (manifest.erasing || manifest.entries[cacheKey]) return;
        const randomHex = () =>
          Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
            'hex',
          );
        const keyRef = `${KEY_PREFIX}${randomHex()}`;
        const key = randomHex();
        const ciphertext = await encryptStringAsyncWithFormat({
          data: scope.password,
          dataEncoding: 'utf8',
          password: key,
          allowRawPassword: true,
          format: 'v2',
          aad: cacheKey,
          dataType: DATA_TYPE,
          enablePbkdf2Cache: false,
        });
        // Journal the reference before creating the key, so interrupted writes
        // remain erasable. A pending entry never enables biometric restore.
        manifest.entries[cacheKey] = { keyRef };
        await this.writeManifest(manifest);
        await secureStorage.setSecureItemWithBiometrics(keyRef, key, {
          keychainService: keyRef,
          authenticationPrompt: appLocale.intl.formatMessage({
            id: ETranslations.verify_backup_password,
          }),
        });
        // No read-back: Android authenticates the write; iOS authenticates reads.
        manifest.entries[cacheKey] = { keyRef, ciphertext };
        await this.writeManifest(manifest);
      });
    } catch {
      // Optional cache failure must not abort a successful backup/manual restore.
    }
  }

  async remove(scope: ICacheScope): Promise<void> {
    if (!isSupported(scope) || !scope.accountId || !scope.recordId) return;
    try {
      await this.mutex.runExclusive(async () => {
        if (this.resetting || this.erasurePending)
          throw new OneKeyLocalError('Recovery cache unavailable');
        const manifest = await this.readManifest();
        if (manifest.erasing)
          throw new OneKeyLocalError('Recovery cache erasure pending');
        const cacheKey = getCacheKey(scope);
        const entry = manifest.entries[cacheKey];
        if (!entry) return;
        // Corrupt metadata must not make one record delete another record's key.
        if (
          Object.entries(manifest.entries).some(
            ([otherScope, other]) =>
              otherScope !== cacheKey && other.keyRef === entry.keyRef,
          )
        )
          throw new OneKeyLocalError('Invalid recovery cache');
        await secureStorage.removeSecureItem(entry.keyRef, {
          keychainService: entry.keyRef,
        });
        this.assertPersistenceAvailable();
        delete manifest.entries[cacheKey];
        await this.writeManifest(manifest);
      });
    } catch {
      // Preserve the remote record as a retry target; never expose native errors.
      throw new OneKeyLocalError('Recovery cache removal failed');
    }
  }

  private async inspectPreservedErasureIntent(): Promise<void> {
    this.assertPersistenceAvailable();
    try {
      if (await secureStorage.getSecureItem(ERASURE_KEY)) {
        this.erasurePending = true;
      }
    } catch {
      // An unreadable optional cache is not a new request to erase it.
    }
    this.assertPersistenceAvailable();
    try {
      const raw = await secureStorage.getSecureItem(MANIFEST_KEY);
      // Inspect the envelope before validating entries: a broken entry must not
      // hide a readable tombstone, including when the separate marker is absent.
      const manifest = raw
        ? (JSON.parse(raw) as { erasing?: unknown } | null)
        : null;
      if (manifest?.erasing) this.erasurePending = true;
    } catch {
      // Preserve every byte on read/parse failure. Unknown is not erased/absent;
      // future cache access still checks both markers and validates the manifest.
    }
    this.assertPersistenceAvailable();
  }

  async prepareForReset({ preserve }: { preserve: boolean }): Promise<void> {
    // Block queued operations immediately; the mutex drains existing cache work.
    this.resetting = true;
    if (!preserve) this.erasurePending = true;
    await this.mutex.runExclusive(async () => {
      try {
        if (preserve && !this.erasurePending) {
          await this.inspectPreservedErasureIntent();
          if (!this.erasurePending) return;
        }
        let failed = false;
        const persistErasureIntent = async () => {
          this.erasurePending = true;
          try {
            this.assertPersistenceAvailable();
            await secureStorage.setSecureItem(ERASURE_KEY, '1');
            this.assertPersistenceAvailable();
            if ((await secureStorage.getSecureItem(ERASURE_KEY)) !== '1') {
              throw new OneKeyLocalError('Recovery erasure marker failed');
            }
            this.assertPersistenceAvailable();
          } catch {
            failed = true;
          }
        };
        // Independent of manifest decoding/writing. If the tombstone and a key
        // deletion fail, this marker still denies reads after a process restart.
        await persistErasureIntent();
        const manifest = await this.readManifest();
        // A durable tombstone denies recovery after an interrupted security wipe.
        // If it cannot be written, still attempt every key deletion. Never let
        // one unavailable item prevent erasure of the remaining credentials.
        manifest.erasing = true;
        try {
          await this.writeManifest(manifest);
        } catch {
          failed = true;
        }
        for (const { keyRef } of Object.values(manifest.entries)) {
          try {
            this.assertPersistenceAvailable();
            await secureStorage.removeSecureItem(keyRef, {
              keychainService: keyRef,
            });
            this.assertPersistenceAvailable();
          } catch {
            failed = true;
          }
        }
        if (failed) throw new OneKeyLocalError('Recovery cache erasure failed');
        this.assertPersistenceAvailable();
        await secureStorage.removeSecureItem(MANIFEST_KEY);
        this.assertPersistenceAvailable();
        if (await secureStorage.getSecureItem(MANIFEST_KEY)) {
          throw new OneKeyLocalError('Recovery cache erasure failed');
        }
        this.assertPersistenceAvailable();
        // Keep the independent intent until every key and the manifest are gone.
        await secureStorage.removeSecureItem(ERASURE_KEY);
        this.assertPersistenceAvailable();
        if (await secureStorage.getSecureItem(ERASURE_KEY)) {
          throw new OneKeyLocalError('Recovery cache erasure failed');
        }
        this.assertPersistenceAvailable();
        this.erasurePending = false;
      } catch {
        throw new OneKeyLocalError('Recovery cache erasure failed');
      }
    });
  }
}

export default new LocalBackupPasswordCache();
