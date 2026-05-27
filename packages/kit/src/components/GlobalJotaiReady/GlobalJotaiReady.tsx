import { startTransition, useEffect, useState } from 'react';

import { View } from 'react-native';

import { globalColdStartHydrationReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/coldStartReady';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Web/desktop split the gate into two paths:
//  - "happy path": cold-start hydration recovered non-empty L1 entries
//    (didHydrate === true). Release the React mount gate immediately so the
//    TTI win from L1 priming is preserved. jotaiInit continues reconciling
//    in the background and may trigger one re-render per persist atom.
//  - "fallback path": cold-start hydration recovered nothing
//    (didHydrate === false: fresh install, kill switch, timeout with no
//    entries, error) OR the hydration ready promise rejected. In that case
//    we additionally await globalJotaiStorageReadyHandler so the
//    source-of-truth values are in jotai before React mounts — trading TTI
//    for correctness exactly in cases where the L1 priming had nothing to
//    contribute anyway. A max-wait safety timer guarantees the gate always
//    releases even if both handlers somehow never settle.
// Native/extension keep the existing single-handler gate to preserve their
// current boot semantics.
const isWebOrDesktop = platformEnv.isWeb || platformEnv.isDesktop;

// Max wait before we force-release the gate. Picked at 5s: long enough for
// the slowest expected jotaiInit reconcile (200–500ms typical, up to a few
// seconds on cold IDB), short enough that a stuck handler can never hang
// the app forever.
const GATE_SAFETY_TIMEOUT_MS = 5000;

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
        // Rejection is surfaced as 'timeout' so the caller treats it as a
        // degraded path (same as didHydrate=false). The cold-start handler
        // currently resolves with a boolean and never rejects, but we guard
        // anyway per the task contract.
        resolve('timeout');
      },
    );
  });
}

async function waitForJotaiReadyOnWebOrDesktop(): Promise<void> {
  // Race the cold-start hydration ready promise against the safety timer.
  const coldStartResult = await withTimeout(
    globalColdStartHydrationReadyHandler.ready,
    GATE_SAFETY_TIMEOUT_MS,
  );
  if (coldStartResult === true) {
    // Happy path: L1 had data, mount immediately.
    return;
  }
  // Fallback path: either didHydrate=false, the promise rejected, or the
  // safety timer fired. Wait for jotaiInit's reconcile loop to publish
  // source-of-truth values — bounded by the remaining safety budget so the
  // gate cannot hang. If the timer already fired above, release now.
  if (coldStartResult === 'timeout') {
    return;
  }
  await withTimeout(
    globalJotaiStorageReadyHandler.ready,
    GATE_SAFETY_TIMEOUT_MS,
  );
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
    // The web/desktop gate is "ready" the moment cold-start hydration has
    // resolved with didHydrate=true. If didHydrate=false we still need to
    // wait on the jotai storage handler, so report not-ready in that case.
    if (globalColdStartHydrationReadyHandler.isReady) {
      if (globalColdStartHydrationReadyHandler.didHydrate) return true;
      return globalJotaiStorageReadyHandler.isReady;
    }
    return false;
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
    if (isWebOrDesktop) {
      void waitForJotaiReadyOnWebOrDesktop().then(release);
    } else {
      // Native/extension: single handler, always resolves with `true`.
      void globalJotaiStorageReadyHandler.ready.then(release);
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
