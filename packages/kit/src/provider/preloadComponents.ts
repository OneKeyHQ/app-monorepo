import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Keep this list limited to common UI chunks that are likely needed soon after boot.
const componentPreloadTasks: Array<() => Promise<unknown>> = [
  () => Dialog.preloadForm(),
];

if (platformEnv.isWeb) {
  componentPreloadTasks.push(
    async () => {
      const { preloadLazyTooltip } =
        await import('@onekeyhq/components/src/actions/LazyTooltip');
      await preloadLazyTooltip();
    },
    async () => {
      const { preloadLazyPopover } =
        await import('@onekeyhq/components/src/actions/LazyPopover');
      await preloadLazyPopover();
    },
  );
}

async function runComponentPreloadTask(task: () => Promise<unknown>) {
  try {
    await task();
  } catch {
    // Preload is best-effort and must not affect boot.
  }
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function deferComponentPreload() {
  await nextFrame();
  await nextFrame();
  await nextFrame();
}

export function preloadComponentsOnIdle() {
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
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    idleHandle = requestIdleCallback(runPreloads);
  }

  function runPreloads(deadline: IdleDeadline) {
    if (cancelled) {
      return;
    }
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    if (deadline.timeRemaining() <= 0) {
      scheduleIdlePreload();
      return;
    }
    const task = componentPreloadTasks[taskIndex];
    taskIndex += 1;
    void runComponentPreloadTask(task).then(() => {
      scheduleIdlePreload();
    });
  }

  void deferComponentPreload().then(scheduleIdlePreload, scheduleIdlePreload);

  return () => {
    cancelled = true;
    if (idleHandle !== undefined) {
      cancelIdleCallback(idleHandle);
    }
  };
}
