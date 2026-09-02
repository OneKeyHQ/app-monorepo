/* eslint-disable @typescript-eslint/no-require-imports */

let bootstrapGeneration = 0;

export async function bootstrapNativeStorage({
  force = false,
}: { force?: boolean } = {}) {
  const generation = (bootstrapGeneration += 1);
  const { bootstrapNativeSyncStorageMirrors, refreshNativeSyncStorageMirrors } =
    require('@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror') as typeof import('@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror');

  await (force
    ? refreshNativeSyncStorageMirrors()
    : bootstrapNativeSyncStorageMirrors());
  if (generation !== bootstrapGeneration) {
    return;
  }

  try {
    const { coldStartCacheStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    const { EAppSyncStorageKeys } =
      require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');
    const raw = coldStartCacheStorage.getString(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
    );
    if (!raw) {
      return;
    }

    const { normalizeSwapColdStartCacheSnapshot } =
      require('@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils') as typeof import('@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils');
    const { CONTEXT_ATOM_COLD_START_CACHE_KEYS } =
      require('@onekeyhq/shared/src/consts/jotaiConsts') as typeof import('@onekeyhq/shared/src/consts/jotaiConsts');
    const snapshot = normalizeSwapColdStartCacheSnapshot(JSON.parse(raw));
    (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ = snapshot;
    const perpsEntry = Object.entries(snapshot).find(([key]) =>
      key.endsWith(
        `::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsL2BookColdCacheAtom}`,
      ),
    );
    if (perpsEntry) {
      (globalThis as any).__ONEKEY_PERPS_L2_BOOK_COLD_CACHE__ = perpsEntry[1];
    }

    const { NativeLogger, LogLevel } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger.write(
      LogLevel.Info,
      `[StartupTiming] bg-proxied contextAtom snapshot hydrated: ${Object.keys(snapshot).length} keys (+${Date.now() - ((globalThis as any).__ONEKEY_MAIN_ENTRY_START__ as number)}ms)`,
    );

    const { warmCriticalIcons } =
      require('@onekeyhq/components/src/primitives/Icon') as typeof import('@onekeyhq/components/src/primitives/Icon');
    warmCriticalIcons();
    const { prewarmColdStartImagesFromSnapshot } =
      require('@onekeyhq/kit/src/utils/coldStartImagePreload') as typeof import('@onekeyhq/kit/src/utils/coldStartImagePreload');
    void prewarmColdStartImagesFromSnapshot();
  } catch (error) {
    // A corrupt best-effort display cache must not turn a successful storage
    // migration into a startup failure.
    console.error('[NativeStorageBootstrap] cold-start cache ignored', error);
  }
}
