/* eslint-disable @typescript-eslint/no-require-imports */

export async function bootstrapNativeStorage({
  force = false,
}: { force?: boolean } = {}) {
  const { bootstrapNativeSyncStorageMirrors, refreshNativeSyncStorageMirrors } =
    require('@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror') as typeof import('@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror');

  await (force
    ? refreshNativeSyncStorageMirrors()
    : bootstrapNativeSyncStorageMirrors());
}

// Reads the contextAtom snapshot into `__ONEKEY_CTX_ATOM_SNAPSHOT__`. Must run
// AFTER the travel-mode runtime launch is acknowledged: until then every
// synchronous storage read is masked (returns undefined), so reading the
// snapshot inside `bootstrapNativeStorage` silently found nothing (OK-61505).
export function hydrateColdStartSnapshotAfterRuntimeLaunch() {
  try {
    const { readContextAtomSnapshotRaw } =
      require('@onekeyhq/shared/src/storage/uiSnapshotCaches') as typeof import('@onekeyhq/shared/src/storage/uiSnapshotCaches');
    const raw = readContextAtomSnapshotRaw();
    if (!raw) {
      writeBootstrapLog('[StartupTiming] contextAtom snapshot absent');
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

    writeBootstrapLog(
      `[StartupTiming] contextAtom snapshot hydrated: ${Object.keys(snapshot).length} keys (+${Date.now() - ((globalThis as any).__ONEKEY_MAIN_ENTRY_START__ as number)}ms)`,
    );
  } catch (error) {
    // A corrupt best-effort display cache must not turn a successful storage
    // migration into a startup failure.
    console.error('[NativeStorageBootstrap] cold-start cache ignored', error);
    writeBootstrapLog(
      `[NativeStorageBootstrap] cold-start cache ignored: ${
        error instanceof Error
          ? `${error.message}\n${error.stack ?? ''}`
          : String(error)
      }`,
    );
  }
}

function writeBootstrapLog(message: string) {
  try {
    const { NativeLogger, LogLevel } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger.write(LogLevel.Info, message);
  } catch {
    // Logging is best-effort during bootstrap.
  }
}
