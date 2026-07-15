import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import platformEnv, { ERuntimeRole } from '../../platformEnv';
import cacheUtils from '../../utils/cacheUtils';
import timerUtils from '../../utils/timerUtils';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';

import { SUPABASE_STORAGE_KEY_PREFIX } from './consts';
import { buildSupabaseSealedValueCodec } from './sealedValueCodec';

import type { ISupabaseSealedValueCodec } from './sealedValueCodec';

const shouldUseSecureStorage = cacheUtils.memoizee(
  async () => {
    const isSupportSecureStorage =
      await secureStorageInstance.supportSecureStorageWithoutInteraction();
    if (!isSupportSecureStorage) {
      return false;
    }
    if (platformEnv.isNative) {
      return true;
    }
    // The secure storage of the desktop in the development environment does not work, the data written only has the key, and the value is always empty
    if (platformEnv.isDesktop && !platformEnv.isDev) {
      return true;
    }
    return false;
  },
  { promise: true, primitive: true },
);

const prefixedKeys = new Set<string>();

const withPrefixedKey = (key: string) => {
  const newKey = `${SUPABASE_STORAGE_KEY_PREFIX as string}${key}`;
  prefixedKeys.add(newKey);
  return newKey;
};

const buildCacheSourceId = () =>
  `supabase-storage-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export class SupabaseStorage {
  constructor({
    sealedValueCodec,
  }: { sealedValueCodec?: ISupabaseSealedValueCodec } = {}) {
    this.sealedValueCodec = sealedValueCodec ?? buildSupabaseSealedValueCodec();
    appEventBus.on(
      EAppEventBusNames.SupabaseStorageCacheCleared,
      ({ sourceId }) => {
        if (sourceId === this.cacheSourceId) {
          return;
        }
        this.clearLocalCache();
      },
    );
  }

  private readonly cacheSourceId = buildCacheSourceId();

  // Device-key sealing for the non-secure-storage fallback path (ext / web /
  // dev desktop). Wallet-recovery-scoped OAuth session material must not sit
  // as plaintext in appStorage on disk; see ./sealedValueCodec.ts. Native and
  // production desktop keep using OS secure storage unchanged.
  private readonly sealedValueCodec: ISupabaseSealedValueCodec;

  private readonly getItemWithCache = cacheUtils.memoizee(
    async (key: string) => {
      // eslint-disable-next-line no-param-reassign
      key = withPrefixedKey(key);

      if (await shouldUseSecureStorage()) {
        return (await secureStorageInstance.getSecureItem(key)) ?? null;
      }
      const rawValue = (await appStorage.getItem(key)) ?? null;
      if (rawValue === null) {
        return null;
      }
      if (!this.sealedValueCodec.isSealedValue(rawValue)) {
        // Legacy plaintext value written before device-key sealing existed
        // (or written by a runtime where WebCrypto/IndexedDB is unavailable):
        // keep it working as-is and opportunistically rewrite it sealed.
        this.resealLegacyPlainValue(key, rawValue);
        return rawValue;
      }
      // Recognized sealed envelope: a genuine decrypt failure (device key
      // lost, e.g. browser cleared IndexedDB) returns null — the session is
      // unrecoverable and the user re-OAuths.
      return this.sealedValueCodec.unsealValue({ key, sealedValue: rawValue });
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  private clearLocalCache() {
    this.getItemWithCache.clear();
  }

  // Best-effort one-time migration of a legacy plaintext value to a sealed
  // one. Restricted to the runtime that owns supabase session WRITES (ext bg
  // service worker / native bg / standalone web+desktop — the token-refresh
  // runtime, see supabaseClientUtils.isSupabaseTokenRefreshRuntime), so a
  // `main` UI-runtime read can never race a concurrent bg token refresh and
  // clobber the newer session. Both runtimes can still READ sealed values:
  // the device key lives in origin-shared IndexedDB (one shared
  // browser-native resource; each runtime only holds its own in-memory
  // CryptoKey handle).
  private resealLegacyPlainValue(prefixedKey: string, plainValue: string) {
    if (platformEnv.runtimeRole === ERuntimeRole.Main) {
      return;
    }
    void (async () => {
      const sealedValue = await this.sealedValueCodec.sealValue({
        key: prefixedKey,
        value: plainValue,
      });
      if (sealedValue === null) {
        return;
      }
      // Re-read before writing: a concurrent auth-js token refresh in this
      // runtime (getItem -> expired -> refresh -> setItem) may have already
      // rotated and rewritten the session while the device key was being
      // resolved. Never clobber the newer write with the resealed OLD value
      // — its single-use rotating refresh token is already consumed, and
      // re-using it past the GoTrue reuse window revokes the whole token
      // family (forced logout).
      if ((await appStorage.getItem(prefixedKey)) !== plainValue) {
        return;
      }
      await appStorage.setItem(prefixedKey, sealedValue);
      // No cache clear: the logical value is unchanged, only its at-rest
      // encoding.
    })().catch(() => {
      // Best-effort: the plaintext value keeps working until the next read.
    });
  }

  clearCache({ syncRemote = true }: { syncRemote?: boolean } = {}) {
    this.clearLocalCache();
    if (!syncRemote) {
      return;
    }
    appEventBus.emit(EAppEventBusNames.SupabaseStorageCacheCleared, {
      sourceId: this.cacheSourceId,
    });
  }

  async getItem(key: string): Promise<string | null> {
    return this.getItemWithCache(key);
  }

  async setItem(key: string, value: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.clearCache({ syncRemote: false });

    if (await shouldUseSecureStorage()) {
      const result = await secureStorageInstance.setSecureItem(key, value);
      this.clearCache();
      return result;
    }
    // Seal with the device key when available; sealValue returns null when
    // WebCrypto/IndexedDB is unavailable (older webviews, jest), in which
    // case we keep the pre-sealing plaintext behavior.
    const sealedValue = await this.sealedValueCodec.sealValue({ key, value });
    const result = await appStorage.setItem(key, sealedValue ?? value);
    this.clearCache();
    return result;
  }

  async removeItem(key: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.clearCache({ syncRemote: false });

    if (await shouldUseSecureStorage()) {
      const result = await secureStorageInstance.removeSecureItem(key);
      this.clearCache();
      return result;
    }
    const result = await appStorage.removeItem(key);
    this.clearCache();
    return result;
  }

  async getAllKeys() {
    return Array.from(prefixedKeys);
  }

  async clear() {
    const keysToRemove = await this.getAllKeys();

    if (!keysToRemove.length) {
      this.clearCache();
      return;
    }
    const _shouldUseSecureStorage = await shouldUseSecureStorage();

    await Promise.all(
      keysToRemove.map((k) => {
        if (_shouldUseSecureStorage) {
          return secureStorageInstance.removeSecureItem(k);
        }
        return appStorage.removeItem(k);
      }),
    );

    prefixedKeys.clear();
    this.clearCache();
  }
}
