import { NativeModules } from 'react-native';

import { COLD_START_CACHE_STORAGE_NATIVE_MODULE } from './coldStartCacheStorageConfig';

type IColdStartCacheKeyNativeModule = {
  encryptionKey?: string;
  getConstants?: () => { encryptionKey?: string };
};

type IColdStartCacheKeyGlobal = typeof globalThis & {
  __ONEKEY_COLD_START_CACHE_STORAGE_ENCRYPTION_KEY__?: string;
};

function normalizeEncryptionKey(key: unknown) {
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

function getGlobalEncryptionKey() {
  return normalizeEncryptionKey(
    (globalThis as IColdStartCacheKeyGlobal)
      .__ONEKEY_COLD_START_CACHE_STORAGE_ENCRYPTION_KEY__,
  );
}

function setGlobalEncryptionKey(key: string) {
  (
    globalThis as IColdStartCacheKeyGlobal
  ).__ONEKEY_COLD_START_CACHE_STORAGE_ENCRYPTION_KEY__ = key;
}

export function getColdStartCacheStorageEncryptionKey() {
  const globalKey = getGlobalEncryptionKey();
  if (globalKey) {
    return globalKey;
  }

  const nativeModule = (
    NativeModules as Record<string, IColdStartCacheKeyNativeModule> | undefined
  )?.[COLD_START_CACHE_STORAGE_NATIVE_MODULE];
  const nativeKey = normalizeEncryptionKey(
    nativeModule?.encryptionKey ??
      nativeModule?.getConstants?.()?.encryptionKey,
  );
  if (nativeKey) {
    setGlobalEncryptionKey(nativeKey);
  }
  return nativeKey;
}
