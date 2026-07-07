import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const IDLE_PRELOAD_TIMEOUT_MS = 3000;
const SHIM_IDLE_PRELOAD_DELAY_MS = 3000;

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

function isRequestIdleCallbackShim() {
  return Boolean(
    (
      requestIdleCallback as typeof requestIdleCallback & {
        __ONEKEY_REQUEST_IDLE_CALLBACK_SHIM__?: true;
      }
    ).__ONEKEY_REQUEST_IDLE_CALLBACK_SHIM__,
  );
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
  let timerHandle: ReturnType<typeof setTimeout> | undefined;
  let taskIndex = 0;
  const shouldDelayForIdleShim = isRequestIdleCallbackShim();

  function scheduleIdlePreload() {
    if (cancelled) {
      return;
    }
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    if (shouldDelayForIdleShim) {
      timerHandle = setTimeout(() => {
        timerHandle = undefined;
        if (!cancelled) {
          idleHandle = requestIdleCallback(runPreloads);
        }
      }, SHIM_IDLE_PRELOAD_DELAY_MS);
      return;
    }
    idleHandle = requestIdleCallback(runPreloads, {
      timeout: IDLE_PRELOAD_TIMEOUT_MS,
    });
  }

  function runPreloads(deadline: IdleDeadline) {
    idleHandle = undefined;
    if (cancelled) {
      return;
    }
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    if (deadline.timeRemaining() <= 0 && !deadline.didTimeout) {
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
    if (timerHandle !== undefined) {
      clearTimeout(timerHandle);
    }
  };
}
