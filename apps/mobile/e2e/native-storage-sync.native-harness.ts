import { NativeModules } from 'react-native';
import { describe, expect, test } from 'react-native-harness';
// The package subpath deliberately bypasses the harness's in-memory MMKV facade.
import { createMMKV, existsMMKV } from 'react-native-mmkv/src';
import { getPlatformContext } from 'react-native-mmkv/src/getMMKVFactory';

// Load the native filesystem directly, without the app's platform facade.
const nativeFS: typeof import('react-native-fs') = require('react-native-fs');

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

  test('commits the real app-storage journal and retains its owner across trim', async () => {
    const id = 'onekey-app-storage-v1';
    const marker = '__native_undo_harness_ack_v1__';
    const growth = '__native_undo_harness_growth_v1__';
    const markerValue = 'synthetic-native-undo-v1';
    const existed = existsMMKV(id);
    const store = createMMKV({ id });
    const keys = store.getAllKeys();
    // Refuse a populated store unless it belongs exclusively to this fixture.
    // Boolean assertions avoid exposing unrelated key names in a failed report.
    expect(keys.every((key) => key === marker || key === growth)).toBe(true);
    if (existed) {
      // A second normal process launch must read the previously ACKed marker.
      expect(store.getString(marker) === markerValue).toBe(true);
    } else {
      expect(keys.length === 0).toBe(true);
    }
    const dataPath = `${getPlatformContext().getBaseDirectory()}/${id}`;
    const journalPath = `${dataPath}.onekey-undo`;
    const controlPath = `${nativeFS.DocumentDirectoryPath}/.onekey-native-undo-harness.control`;
    const readyPath = `${nativeFS.DocumentDirectoryPath}/.onekey-native-undo-harness.ready`;
    const pauseBeforeAck = await nativeFS.exists(controlPath);
    if (pauseBeforeAck) {
      const control = await nativeFS.readFile(controlPath, 'utf8');
      expect(control === 'onekey-native-undo-harness-kill-before-ack-v1').toBe(
        true,
      );
    }
    expect(await nativeFS.exists(dataPath)).toBe(true);
    expect(await nativeFS.exists(journalPath)).toBe(false);

    store.set(marker, markerValue);
    expect(await nativeFS.exists(journalPath)).toBe(true);
    await expect(nativeStorage.syncMMKV(id)).resolves.toBeNull();
    expect(await nativeFS.exists(journalPath)).toBe(false);
    expect(store.getString(marker)).toBe(markerValue);

    if (pauseBeforeAck) {
      // The dedicated simulator is killed externally after this ready signal.
      store.set(marker, 'synthetic-native-undo-unack-v1');
      expect(await nativeFS.exists(journalPath)).toBe(true);
      await nativeFS.writeFile(
        readyPath,
        'onekey-native-undo-harness-pending-v1',
        'utf8',
      );
      await new Promise<void>(() => undefined);
    }

    // About 2.6 MiB of synthetic data exercises the multi-MiB storage scale.
    // Remove only our fixture key afterward so trim must compact the file.
    store.set(growth, 'synthetic-growth-'.repeat(160_000));
    await expect(nativeStorage.syncMMKV(id)).resolves.toBeNull();
    expect(store.remove(growth)).toBe(true);
    await expect(nativeStorage.syncMMKV(id)).resolves.toBeNull();
    const beforeTrim = await nativeFS.stat(dataPath);
    store.trim();
    // NitroMmkv's trim also clears Core's memory cache. Reloading a value must
    // retain this live transaction rather than roll it back as a cold crash.
    expect(await nativeFS.exists(journalPath)).toBe(true);
    expect(store.getString(marker)).toBe(markerValue);
    expect(store.contains(growth)).toBe(false);
    const afterTrim = await nativeFS.stat(dataPath);
    expect(Number(afterTrim.size)).toBeLessThan(Number(beforeTrim.size));
    await expect(nativeStorage.syncMMKV(id)).resolves.toBeNull();
    expect(await nativeFS.exists(journalPath)).toBe(false);
    expect(store.getString(marker)).toBe(markerValue);
    // Keep this acknowledged synthetic marker for an explicit normal restart.
  });

  test('rejects unsupported IDs through the existing Promise error code', async () => {
    await expect(
      nativeStorage.syncMMKV('checked-sync-not-allowlisted'),
    ).rejects.toMatchObject({ code: 'MMKV_SYNC_FAILED' });
  });
});
