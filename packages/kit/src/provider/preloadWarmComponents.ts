import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { deferHeavyWorkUntilUIIdle } from '../utils/deferHeavyWork';

// Keep this list limited to common UI chunks that are likely needed soon after boot.
const warmComponentPreloadTasks: Array<() => Promise<unknown>> = [
  () => Dialog.preloadForm(),
];

async function runWarmComponentPreloads() {
  const tasks = warmComponentPreloadTasks.map(async (task) => task());
  await Promise.allSettled(tasks);
}

export function preloadWarmComponents() {
  if (!(platformEnv.isWeb || platformEnv.isDesktop)) {
    return undefined;
  }

  if (typeof requestIdleCallback !== 'function') {
    return undefined;
  }

  let cancelled = false;
  let idleHandle: ReturnType<typeof requestIdleCallback> | undefined;

  function scheduleIdlePreload() {
    if (cancelled) {
      return;
    }
    idleHandle = requestIdleCallback(runPreloads);
  }

  function runPreloads(deadline: IdleDeadline) {
    if (cancelled) {
      return;
    }
    if (deadline.timeRemaining() <= 0) {
      scheduleIdlePreload();
      return;
    }
    void runWarmComponentPreloads();
  }

  void deferHeavyWorkUntilUIIdle({
    minFrames: 2,
    includeInteractions: false,
  }).then(scheduleIdlePreload, scheduleIdlePreload);

  return () => {
    cancelled = true;
    if (idleHandle !== undefined) {
      cancelIdleCallback(idleHandle);
    }
  };
}
