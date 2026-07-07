import {
  Dialog,
  preloadLazyPopover,
  preloadLazyTooltip,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { deferHeavyWorkUntilUIIdle } from '../utils/deferHeavyWork';

// Keep this list limited to common UI chunks that are likely needed soon after boot.
const warmComponentPreloadTasks: Array<() => Promise<unknown>> = [
  () => Dialog.preloadForm(),
  preloadLazyTooltip,
  preloadLazyPopover,
];

async function runWarmComponentPreloadTask(task: () => Promise<unknown>) {
  try {
    await task();
  } catch {
    // Warmup is best-effort and must not affect boot.
  }
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
  let taskIndex = 0;

  function scheduleIdlePreload() {
    if (cancelled) {
      return;
    }
    if (taskIndex >= warmComponentPreloadTasks.length) {
      return;
    }
    idleHandle = requestIdleCallback(runPreloads);
  }

  function runPreloads(deadline: IdleDeadline) {
    if (cancelled) {
      return;
    }
    if (taskIndex >= warmComponentPreloadTasks.length) {
      return;
    }
    if (deadline.timeRemaining() <= 0) {
      scheduleIdlePreload();
      return;
    }
    const task = warmComponentPreloadTasks[taskIndex];
    taskIndex += 1;
    void runWarmComponentPreloadTask(task).then(() => {
      scheduleIdlePreload();
    });
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
