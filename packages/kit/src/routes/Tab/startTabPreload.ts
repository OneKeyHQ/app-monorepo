import { CommonActions } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { getDevicePerformanceTier } from '@onekeyhq/shared/src/performance/devicePerformanceTier';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import { defaultPreloadEntry, tabPreloadConfig } from './preloadConfig';

export function startTabPreload(): (() => void) | undefined {
  const tier = getDevicePerformanceTier();

  const { queue: preloadQueue, intervalMs: PRELOAD_INTERVAL_MS } =
    tabPreloadConfig[tier] ?? defaultPreloadEntry;

  if (preloadQueue.length === 0) return undefined;
  let index = 0;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let idleHandle: ReturnType<typeof requestIdleCallback> | undefined;
  let cancelled = false;

  // Space steps out by PRELOAD_INTERVAL_MS, then run each preload inside
  // requestIdleCallback (every step, not just the first).
  // NOTE: this only yields to a genuinely idle main thread on web/desktop,
  // where requestIdleCallback is the real Chromium API. On native it is the
  // setTimeout(..., 1ms) shim (see shared/src/polyfills/requestIdleCallbackShim),
  // which has no idle awareness; there each step is deferred and paced by the
  // interval timer, not gated on actual main-thread idleness.
  function scheduleNext() {
    timerId = setTimeout(() => {
      idleHandle = requestIdleCallback(preloadNext);
    }, PRELOAD_INTERVAL_MS);
  }

  function preloadNext() {
    if (cancelled || index >= preloadQueue.length) return;

    const rootState = rootNavigationRef.current?.getRootState();
    const mainRoute = rootState?.routes?.find(
      (r) => r.name === ERootRoutes.Main,
    );
    const tabStateKey = mainRoute?.state?.key;

    if (!tabStateKey) {
      scheduleNext();
      return;
    }

    try {
      rootNavigationRef.current?.dispatch({
        ...CommonActions.preload(preloadQueue[index]),
        target: tabStateKey,
      });
    } catch {
      // Tab might not exist in current config (e.g. perp disabled).
    }
    index += 1;
    scheduleNext();
  }

  idleHandle = requestIdleCallback(preloadNext);

  return () => {
    cancelled = true;
    if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
    if (timerId !== undefined) clearTimeout(timerId);
  };
}
