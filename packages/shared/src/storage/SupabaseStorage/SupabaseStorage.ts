import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import platformEnv, { ERuntimeRole } from '../../platformEnv';
import cacheUtils from '../../utils/cacheUtils';
import { SupabaseStorageTransientError } from '../../utils/supabaseAuthErrorUtils';
import timerUtils from '../../utils/timerUtils';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';
import { SECURE_STORAGE_PERMANENT_READ_ERROR_NAME } from '../secureStorage/types';

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

  private readonly writeControlByKey = new Map<
    string,
    { epoch: number; blocked: boolean }
  >();

  private readonly inFlightWritesByKey = new Map<
    string,
    Set<Promise<unknown>>
  >();

  async blockWritesForKey(key: string): Promise<void> {
    const prefixedKey = withPrefixedKey(key);
    const current = this.writeControlByKey.get(prefixedKey);
    this.writeControlByKey.set(prefixedKey, {
      epoch: (current?.epoch ?? 0) + 1,
      blocked: true,
    });
    const inFlight = Array.from(
      this.inFlightWritesByKey.get(prefixedKey) || [],
    );
    if (inFlight.length) {
      await Promise.allSettled(inFlight);
    }
  }

  allowWritesForKey(key: string): void {
    const prefixedKey = withPrefixedKey(key);
    const current = this.writeControlByKey.get(prefixedKey);
    this.writeControlByKey.set(prefixedKey, {
      epoch: (current?.epoch ?? 0) + 1,
      blocked: false,
    });
  }

  private captureWriteEpoch(prefixedKey: string): number | undefined {
    const control = this.writeControlByKey.get(prefixedKey);
    return control?.blocked ? undefined : (control?.epoch ?? 0);
  }

  private isWriteEpochCurrent(prefixedKey: string, epoch: number): boolean {
    const control = this.writeControlByKey.get(prefixedKey);
    return !control?.blocked && (control?.epoch ?? 0) === epoch;
  }

  private trackInFlightWrite<T>(
    prefixedKey: string,
    writePromise: Promise<T>,
  ): Promise<T> {
    const writes =
      this.inFlightWritesByKey.get(prefixedKey) || new Set<Promise<unknown>>();
    writes.add(writePromise);
    this.inFlightWritesByKey.set(prefixedKey, writes);
    void writePromise.then(
      () => writes.delete(writePromise),
      () => writes.delete(writePromise),
    );
    return writePromise;
  }

  private readonly getItemWithCache = cacheUtils.memoizee(
    async (key: string) => {
      // eslint-disable-next-line no-param-reassign
      key = withPrefixedKey(key);

      if (await shouldUseSecureStorage()) {
        try {
          return (await secureStorageInstance.getSecureItem(key)) ?? null;
        } catch (error) {
          // Secure storage reports read failures by throwing — it must not
          // conflate them with absence for consumers holding irreplaceable
          // records. Only a failure the adapter POSITIVELY labeled
          // permanent (a desktop decrypt failure of an existing value) may
          // read as "no session": the session is unrecoverable and
          // re-obtainable via OAuth, mirroring the sealed-codec
          // genuine-decrypt-failure semantics below.
          if (
            (error as Error | undefined)?.name ===
            SECURE_STORAGE_PERMANENT_READ_ERROR_NAME
          ) {
            console.error(
              'SupabaseStorage secure read failed permanently',
              error,
            );
            return null;
          }
          // Everything else is TRANSIENT by default (locked keychain,
          // keyring not ready): the slot state is unknown, and collapsing
          // it into "no session" would let callers destroy a
          // still-recoverable session (see primeAuthSessionAccess).
          // Rethrown as the retryable identity the strict readers already
          // classify; memoizee evicts the rejection next tick, so it is
          // never pinned for maxAge the way a resolved null would be.
          throw new SupabaseStorageTransientError(
            `Supabase secure storage read failed: ${
              (error as Error | undefined)?.message ?? 'unknown'
            }`,
          );
        }
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
      // unrecoverable and the user re-OAuths. A TRANSIENT device-key
      // failure instead rejects with SupabaseStorageTransientError so
      // callers cannot mistake a recoverable session for "no session";
      // memoizee evicts rejected promises on the next tick (same-tick
      // concurrent readers share the retryable rejection), so later reads
      // retry immediately instead of serving a stale failure for maxAge.
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
    const writeEpoch = this.captureWriteEpoch(prefixedKey);
    if (writeEpoch === undefined) {
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
      if (!this.isWriteEpochCurrent(prefixedKey, writeEpoch)) {
        return;
      }
      await this.trackInFlightWrite(
        prefixedKey,
        appStorage.setItem(prefixedKey, sealedValue),
      );
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
    const writeEpoch = this.captureWriteEpoch(key);
    if (writeEpoch === undefined) {
      return;
    }
    this.clearCache({ syncRemote: false });

    if (await shouldUseSecureStorage()) {
      if (!this.isWriteEpochCurrent(key, writeEpoch)) {
        return;
      }
      const result = await this.trackInFlightWrite(
        key,
        secureStorageInstance.setSecureItem(key, value),
      );
      this.clearCache();
      return result;
    }
    // Seal with the device key when available; sealValue returns null when
    // WebCrypto/IndexedDB is unavailable (older webviews, jest), in which
    // case we keep the pre-sealing plaintext behavior. The plaintext
    // fallback is deliberate even when the PREVIOUS stored value was sealed
    // and this failure is transient: rejecting the write instead would lose
    // a just-rotated refresh token that auth-js persists through this
    // setItem (the old token is already consumed server-side), trading a
    // short plaintext-at-rest window for a guaranteed forced re-login.
    const sealedValue = await this.sealedValueCodec.sealValue({ key, value });
    if (!this.isWriteEpochCurrent(key, writeEpoch)) {
      return;
    }
    const result = await this.trackInFlightWrite(
      key,
      appStorage.setItem(key, sealedValue ?? value),
    );
    this.clearCache();
    if (sealedValue === null) {
      // Shrink the plaintext window: retry sealing right away instead of
      // waiting for the next read's opportunistic rewrite (the device-key
      // resolution failure is not pinned, so a retry can succeed). The
      // method self-guards: it no-ops in Main UI runtimes and re-reads
      // before writing so it can never clobber a newer rotated session.
      this.resealLegacyPlainValue(key, value);
    }
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
