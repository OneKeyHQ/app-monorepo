import { Mutex } from 'async-mutex';

import {
  ESecretEncryptPayloadFormat,
  decryptAsyncWithMetadata,
} from '@onekeyhq/core/src/secret';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import simpleDb from '../../dbs/simple/simpleDb';
import { encryptStringAsyncWithFormat } from '../../utils/secretEncryptFormat';

// secureStorage uses device-only Keychain on iOS and Keystore protection on Android.
// Never reuse the synchronizable Cloud Backup V2 Keychain item for this cache.
const DEVICE_KEY = 'com.onekey.backup_v2.local_password.key';

type ICacheScope = {
  providerType: ECloudBackupProviderType;
  accountId: string;
  recordId?: string;
};

function isSupported({ providerType }: ICacheScope): boolean {
  return Boolean(
    (platformEnv.isNativeIOS &&
      providerType === ECloudBackupProviderType.iCloud) ||
    (platformEnv.isNativeAndroid &&
      providerType === ECloudBackupProviderType.GoogleDrive),
  );
}

function getDataType({ providerType }: ICacheScope): string {
  return providerType === ECloudBackupProviderType.iCloud
    ? 'icloud-backup-local-password-v1'
    : 'google-drive-backup-local-password-v1';
}

function getCacheKey({
  providerType,
  accountId,
  recordId,
}: ICacheScope): string {
  return stringUtils.stableStringify({
    // Preserve the existing iCloud key and AAD so saved passwords remain readable.
    ...(providerType === ECloudBackupProviderType.GoogleDrive
      ? { providerType }
      : {}),
    accountId,
    recordId: recordId ?? null,
    version: 1,
  });
}

class LocalBackupPasswordCache {
  // All access is owned by bg; main must never initialize a competing key.
  private mutex = new Mutex();

  async get(scope: ICacheScope): Promise<string | undefined> {
    if (!isSupported(scope) || !scope.accountId) return undefined;
    try {
      return await this.mutex.runExclusive(async () => {
        const cacheKey = getCacheKey(scope);
        const ciphertext =
          await simpleDb.cloudBackupPasswordCache.getPasswordCiphertext(
            cacheKey,
          );
        if (!ciphertext) return undefined;
        // A migrated SimpleDB without its original device key is a cache miss.
        const key = await secureStorage.getSecureItem(DEVICE_KEY);
        if (!key || !/^[0-9a-f]{64}$/.test(key)) return undefined;
        const result = await decryptAsyncWithMetadata({
          data: Buffer.from(ciphertext, 'hex'),
          password: key,
          allowRawPassword: true,
          aad: cacheKey,
          dataType: getDataType(scope),
          enablePbkdf2Cache: false,
        });
        if (result.format !== ESecretEncryptPayloadFormat.v2) return undefined;
        return result.plaintext.toString('utf8') || undefined;
      });
    } catch {
      // Do not log native/crypto errors: they may contain secret inputs.
      console.warn(
        'Local cloud backup password cache unavailable; use manual entry.',
      );
      return undefined;
    }
  }

  async set(scope: ICacheScope & { password: string }): Promise<void> {
    if (!isSupported(scope) || !scope.accountId || !scope.password) return;
    try {
      await this.mutex.runExclusive(async () => {
        let key = await secureStorage.getSecureItem(DEVICE_KEY);
        if (!key || !/^[0-9a-f]{64}$/.test(key)) {
          key = Buffer.from(
            crypto.getRandomValues(new Uint8Array(32)),
          ).toString('hex');
          await secureStorage.setSecureItem(DEVICE_KEY, key);
          if ((await secureStorage.getSecureItem(DEVICE_KEY)) !== key) return;
        }
        const cacheKey = getCacheKey(scope);
        const ciphertext = await encryptStringAsyncWithFormat({
          data: scope.password,
          dataEncoding: 'utf8',
          password: key,
          allowRawPassword: true,
          format: 'v2',
          aad: cacheKey,
          dataType: getDataType(scope),
          enablePbkdf2Cache: false,
        });
        await simpleDb.cloudBackupPasswordCache.setPasswordCiphertext(
          cacheKey,
          ciphertext,
        );
      });
    } catch {
      console.warn('Local cloud backup password cache was not saved.');
    }
  }

  async remove(scope: ICacheScope): Promise<void> {
    if (!isSupported(scope) || !scope.accountId) return;
    try {
      await this.mutex.runExclusive(() =>
        simpleDb.cloudBackupPasswordCache.removePasswordCiphertext(
          getCacheKey(scope),
        ),
      );
    } catch {
      console.warn('Local cloud backup password cache was not removed.');
    }
  }
}

export default new LocalBackupPasswordCache();
