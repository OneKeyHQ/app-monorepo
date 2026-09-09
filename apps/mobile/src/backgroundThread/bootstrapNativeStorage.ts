/* eslint-disable @typescript-eslint/no-require-imports */

// Upper bound on how long the app mount waits for the first-paint images
// (home banner cards + header network logos) started by
// `startColdStartImagePrewarm`. Disk-cached images decode well inside this
// window and usually finish during the jotai hydration that runs in between;
// a cold disk cache (first launch, evicted entries) gives up and renders with
// the skeleton as before.
const COLD_START_CRITICAL_IMAGES_TIMEOUT_MS = 300;

export async function waitForColdStartCriticalImagesBeforeMount() {
  const startedAt = Date.now();
  let status: 'done' | 'timeout' | 'error' = 'done';
  let count = 0;
  try {
    const { waitForColdStartCriticalImages } =
      require('@onekeyhq/kit/src/utils/coldStartImagePreload') as typeof import('@onekeyhq/kit/src/utils/coldStartImagePreload');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(
        () => resolve('timeout'),
        COLD_START_CRITICAL_IMAGES_TIMEOUT_MS,
      );
    });
    const result = await Promise.race([
      waitForColdStartCriticalImages(),
      timeout,
    ]);
    clearTimeout(timer);
    if (result === 'timeout') {
      status = 'timeout';
    } else {
      count = result;
    }
  } catch {
    status = 'error';
  }
  try {
    const { NativeLogger, LogLevel } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger.write(
      LogLevel.Info,
      `[StartupTiming] cold-start critical images ${status}: ${count} images, waited ${
        Date.now() - startedAt
      }ms (+${Date.now() - ((globalThis as any).__ONEKEY_MAIN_ENTRY_START__ as number)}ms)`,
    );
  } catch {
    // Logging is best-effort during bootstrap.
  }
}

export async function bootstrapNativeStorage({
  force = false,
}: { force?: boolean } = {}) {
  const { bootstrapNativeSyncStorageMirrors, refreshNativeSyncStorageMirrors } =
    require('@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror') as typeof import('@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror');

  await (force
    ? refreshNativeSyncStorageMirrors()
    : bootstrapNativeSyncStorageMirrors());
}

// Reads the bg-proxied contextAtom snapshot into `__ONEKEY_CTX_ATOM_SNAPSHOT__`
// and starts the cold-start image prewarm. Must run AFTER the travel-mode
// runtime launch is acknowledged: until then every synchronous storage read
// is masked (returns undefined), so reading the snapshot inside
// `bootstrapNativeStorage` silently found nothing (OK-61505).
export function hydrateColdStartSnapshotAfterRuntimeLaunch() {
  try {
    const { coldStartCacheStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    const { EAppSyncStorageKeys } =
      require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');
    const raw = coldStartCacheStorage.getString(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
    );
    if (!raw) {
      writeBootstrapLog(
        '[StartupTiming] bg-proxied contextAtom snapshot absent, cold-start image prewarm skipped',
      );
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
      `[StartupTiming] bg-proxied contextAtom snapshot hydrated: ${Object.keys(snapshot).length} keys (+${Date.now() - ((globalThis as any).__ONEKEY_MAIN_ENTRY_START__ as number)}ms)`,
    );

    const { warmCriticalIcons } =
      require('@onekeyhq/components/src/primitives/Icon') as typeof import('@onekeyhq/components/src/primitives/Icon');
    warmCriticalIcons();
    const { startColdStartImagePrewarm } =
      require('@onekeyhq/kit/src/utils/coldStartImagePreload') as typeof import('@onekeyhq/kit/src/utils/coldStartImagePreload');
    void startColdStartImagePrewarm();
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
