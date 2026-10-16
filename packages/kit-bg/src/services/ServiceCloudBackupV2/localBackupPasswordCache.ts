import { Mutex } from 'async-mutex';

import {
  ESecretEncryptPayloadFormat,
  decryptAsyncWithMetadata,
} from '@onekeyhq/core/src/secret';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { encryptStringAsyncWithFormat } from '../../utils/secretEncryptFormat';

// Dedicated device-only recovery material, outside all wallet/settings databases.
// This item contains only scopes, key references and authenticated ciphertext.
const MANIFEST_KEY = 'com.onekey.backup_v2.biometric_password.manifest';
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

  private async readManifest(): Promise<IManifest> {
    const raw = await secureStorage.getSecureItem(MANIFEST_KEY);
    if (!raw) return { entries: {} };
    const manifest = JSON.parse(raw) as IManifest;
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
    return manifest;
  }

  private async writeManifest(manifest: IManifest): Promise<void> {
    await secureStorage.setSecureItem(
      MANIFEST_KEY,
      stringUtils.stableStringify(manifest),
    );
  }

  async get(scope: ICacheScope): Promise<string | undefined> {
    if (!isSupported(scope) || !scope.accountId || !scope.recordId)
      return undefined;
    try {
      return await this.mutex.runExclusive(async () => {
        if (this.resetting) return undefined;
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
          { keychainService: entry.keyRef },
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
        if (this.resetting) return;
        const manifest = await this.readManifest();
        if (manifest.erasing) return;
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
          return;
        await secureStorage.removeSecureItem(entry.keyRef, {
          keychainService: entry.keyRef,
        });
        delete manifest.entries[cacheKey];
        await this.writeManifest(manifest);
      });
    } catch {
      // Leave the reference available for a later erasure retry.
    }
  }

  async prepareForReset({ preserve }: { preserve: boolean }): Promise<void> {
    await this.mutex.runExclusive(async () => {
      // Remain closed until restart, including if the wallet reset is interrupted.
      this.resetting = true;
      if (preserve) return;
      try {
        const manifest = await this.readManifest();
        // A durable tombstone denies recovery after an interrupted security wipe.
        // If it cannot be written, still attempt every key deletion. Never let
        // one unavailable item prevent erasure of the remaining credentials.
        manifest.erasing = true;
        let failed = false;
        try {
          await this.writeManifest(manifest);
        } catch {
          failed = true;
        }
        for (const { keyRef } of Object.values(manifest.entries)) {
          try {
            await secureStorage.removeSecureItem(keyRef, {
              keychainService: keyRef,
            });
          } catch {
            failed = true;
          }
        }
        if (failed) throw new OneKeyLocalError('Recovery cache erasure failed');
        await secureStorage.removeSecureItem(MANIFEST_KEY);
      } catch {
        throw new OneKeyLocalError('Recovery cache erasure failed');
      }
    });
  }
}

export default new LocalBackupPasswordCache();
