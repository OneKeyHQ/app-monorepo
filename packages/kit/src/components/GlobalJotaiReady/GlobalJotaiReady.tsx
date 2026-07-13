import { startTransition, useEffect, useState } from 'react';

import { View } from 'react-native';

import { globalColdStartHydrationReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/coldStartReady';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { prewarmColdStartImagesFromSnapshot } from '../../utils/coldStartImagePreload';

// Web/desktop gate the React mount on BOTH:
//   - globalJotaiStorageReadyHandler: source-of-truth atoms have been
//     reconciled from JotaiStorage IDB into the jotai store, so first render
//     sees real values rather than defaults.
//   - globalColdStartHydrationReadyHandler: cold-start hydration has
//     populated globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__ (L2). Without this,
//     a JotaiContextStore Provider that mounts immediately after React
//     mount would call hydrateContextColdStartCacheForProvider before the
//     snapshot is in globalThis and silently no-op.
// L1 (per-atom mirror) was removed, so there is no "happy path early
// release" — both gates are simply awaited in parallel under a single
// safety timer.
// Native/extension keep the existing single-handler gate to preserve their
// current boot semantics.
const isWebOrDesktop = platformEnv.isWeb || platformEnv.isDesktop;

// Max wait before we force-release the gate. Picked at 5s: long enough for
// the slowest expected jotaiInit reconcile (200–500ms typical, up to a few
// seconds on cold IDB), short enough that a stuck handler can never hang
// the app forever.
const GATE_SAFETY_TIMEOUT_MS = 5000;
const COLD_START_IMAGE_PRIME_TIMEOUT_MS = isWebOrDesktop ? 160 : 0;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | 'timeout'> {
  return new Promise<T | 'timeout'>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('timeout');
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Rejection treated as timeout — both downstream consumers tolerate
        // missing data (fall back to defaults). Currently neither handler
        // rejects, but guard for safety.
        resolve('timeout');
      },
    );
  });
}

async function waitForJotaiReadyOnWebOrDesktop(): Promise<void> {
  // Wait both gates in parallel under a shared 5s safety cap. Either gate
  // failing to settle is acceptable — consumers degrade to defaults.
  const result = await withTimeout(
    Promise.all([
      globalColdStartHydrationReadyHandler.ready,
      globalJotaiStorageReadyHandler.ready,
    ]),
    GATE_SAFETY_TIMEOUT_MS,
  );
  if (result === 'timeout') {
    // Degraded boot: neither gate settled within GATE_SAFETY_TIMEOUT_MS, so
    // the gate is being force-released and React mounts with whatever atom
    // values are present (likely defaults). This is intentional fail-open
    // behavior, but we surface it so web/desktop boots are observable.
    // logGlobalJotaiReady is native-only, so a separate warn is required here.
    defaultLogger.app.bootRecovery.coldStartGateTimeout(
      `[GlobalJotaiReady] cold-start gate did not settle within ${GATE_SAFETY_TIMEOUT_MS}ms; force-releasing with default atom values (first render may see default values)`,
    );
    // Telemetry flag for downstream readers (matches existing __ONEKEY_* globals).
    (globalThis as Record<string, unknown>).__ONEKEY_COLD_START_GATE_TIMEOUT__ =
      true;
  }
}

async function primeColdStartImagesBeforeRender(): Promise<void> {
  await prewarmColdStartImagesFromSnapshot({
    primeTimeoutMs: COLD_START_IMAGE_PRIME_TIMEOUT_MS,
  });
}

const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

function logGlobalJotaiReady(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    const elapsed = Date.now() - jsEntryStart;
    defaultLogger.app.appUpdate.log(
      `[GlobalJotaiReady] ${message} (+${elapsed}ms)`,
    );
  }
}

function isReadySync(): boolean {
  if (isWebOrDesktop) {
    // Both gates must have settled before we can claim sync-ready. Without
    // L1 there is no "fast happy path" — the source-of-truth handler is
    // required for atom correctness, the cold-start handler is required so
    // the L2 ctx snapshot is in globalThis before any Provider mounts.
    return (
      globalColdStartHydrationReadyHandler.isReady &&
      globalJotaiStorageReadyHandler.isReady
    );
  }
  return globalJotaiStorageReadyHandler.isReady;
}

export function GlobalJotaiReady({ children }: { children: any }) {
  const [isReady, setIsReady] = useState(() => isReadySync());
  logGlobalJotaiReady(`render isReady=${isReady}, syncReady=${isReadySync()}`);
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog(
      'GlobalJotaiReady render',
      `isReady=${isReady}, syncReady=${isReadySync()}`,
    );
  }
  useEffect(() => {
    if (isReadySync()) {
      logGlobalJotaiReady('effect sees ready=true, rendering children');
      setIsReady(true);
      return;
    }
    logGlobalJotaiReady('effect waiting for ready promise');
    let isMounted = true;
    const release = () => {
      if (!isMounted) return;
      logGlobalJotaiReady('gate releasing');
      startTransition(() => {
        if (process.env.NODE_ENV !== 'production') {
          debugLandingLog('GlobalJotaiReady resolved', 'released');
        }
        setIsReady(true);
      });
    };
    const releaseAfterImagePrime = () => {
      void primeColdStartImagesBeforeRender().then(release, release);
    };
    if (isWebOrDesktop) {
      void waitForJotaiReadyOnWebOrDesktop().then(releaseAfterImagePrime);
    } else {
      // Native/extension: single handler, always resolves with `true`.
      void globalJotaiStorageReadyHandler.ready.then(releaseAfterImagePrime);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    logGlobalJotaiReady('returning placeholder');
    return <View testID="GlobalJotaiReady-not-ready-placeholder" />;
  }

  logGlobalJotaiReady('rendering children');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return children;
}
