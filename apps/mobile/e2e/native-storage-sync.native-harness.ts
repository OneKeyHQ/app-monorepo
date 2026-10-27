import { NativeModules } from 'react-native';
import { describe, expect, test } from 'react-native-harness';
// The package subpath deliberately bypasses the harness's in-memory MMKV facade.
import { createMMKV, existsMMKV } from 'react-native-mmkv/src';

const nativeStorage: {
  syncMMKV(id: string): Promise<null>;
} = NativeModules.OneKeyNativeStorageMigration;

// Use scripts/test-native-storage-sync.mjs on a dedicated empty test device.
// Never clear an existing store to satisfy the cold-store precondition.
describe('native checked MMKV sync', () => {
  test('rejects a cold absent store without creating it', async () => {
    expect(existsMMKV('onekey-jotai-states')).toBe(false);
    await expect(
      nativeStorage.syncMMKV('onekey-jotai-states'),
    ).rejects.toMatchObject({ code: 'MMKV_SYNC_FAILED' });
    expect(existsMMKV('onekey-jotai-states')).toBe(false);
  });

  test('flushes the same real Core instance used by NitroMmkv', async () => {
    const store = createMMKV({ id: 'onekey-app-dev-setting' });
    const key = '__checked_sync_harness_fixture__';
    try {
      store.set(key, 'native-fixture');
      await expect(
        nativeStorage.syncMMKV('onekey-app-dev-setting'),
      ).resolves.toBeNull();
      expect(store.getString(key)).toBe('native-fixture');
    } finally {
      store.remove(key);
    }
  });

  test('rejects unsupported IDs through the existing Promise error code', async () => {
    await expect(
      nativeStorage.syncMMKV('checked-sync-not-allowlisted'),
    ).rejects.toMatchObject({ code: 'MMKV_SYNC_FAILED' });
  });
});
