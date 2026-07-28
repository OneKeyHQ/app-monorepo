import { Dialog } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

const IDLE_PRELOAD_TIMEOUT_MS = 3000;
const SHIM_IDLE_PRELOAD_DELAY_MS = 3000;

// Keep this list limited to common UI chunks that are likely needed soon after boot.
const componentPreloadTasks: Array<{
  name: string;
  preload: () => Promise<unknown>;
}> = [
  { name: 'DialogForm', preload: () => Dialog.preloadForm() },
  {
    name: 'LazyTooltip',
    preload: async () => {
      const { preloadLazyTooltip } =
        await import('@onekeyhq/components/src/actions/LazyTooltip');
      await preloadLazyTooltip();
    },
  },
  {
    name: 'LazyPopover',
    preload: async () => {
      const { preloadLazyPopover } =
        await import('@onekeyhq/components/src/actions/LazyPopover');
      await preloadLazyPopover();
    },
  },
];

function formatPreloadError(error: unknown) {
  const err = error as { code?: string; message?: string; stack?: string };
  return `${err?.code ? `${err.code}: ` : ''}${err?.message || String(error)}${
    err?.stack ? `\n${err.stack.slice(0, 300)}` : ''
  }`;
}

async function runComponentPreloadTask(
  task: (typeof componentPreloadTasks)[number],
) {
  try {
    await task.preload();
  } catch (error) {
    defaultLogger.app.error.log(
      `[PreloadComponents] ${task.name} failed: ${formatPreloadError(error)}`,
    );
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
  if (typeof requestIdleCallback !== 'function') {
    return undefined;
  }

  let cancelled = false;
  let idleHandle: ReturnType<typeof requestIdleCallback> | undefined;
  let timerHandle: ReturnType<typeof setTimeout> | undefined;
  let unsubscribeVisibilityChange: (() => void) | undefined;
  let taskIndex = 0;
  const shouldDelayForIdleShim = isRequestIdleCallbackShim();

  function clearVisibilityChangeSubscription() {
    unsubscribeVisibilityChange?.();
    unsubscribeVisibilityChange = undefined;
  }

  function waitForVisible() {
    if (unsubscribeVisibilityChange) {
      return;
    }
    unsubscribeVisibilityChange = onVisibilityStateChange((visible) => {
      if (visible) {
        clearVisibilityChangeSubscription();
        scheduleIdlePreload();
      }
    });
  }

  function scheduleRequestIdleCallback() {
    if (cancelled) {
      return;
    }
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    if (!getCurrentVisibilityState()) {
      waitForVisible();
      return;
    }
    idleHandle = requestIdleCallback(runPreloads, {
      timeout: IDLE_PRELOAD_TIMEOUT_MS,
    });
  }

  function scheduleIdlePreload() {
    if (cancelled) {
      return;
    }
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    if (!getCurrentVisibilityState()) {
      waitForVisible();
      return;
    }
    if (shouldDelayForIdleShim) {
      timerHandle = setTimeout(() => {
        timerHandle = undefined;
        scheduleRequestIdleCallback();
      }, SHIM_IDLE_PRELOAD_DELAY_MS);
      return;
    }
    scheduleRequestIdleCallback();
  }

  function runPreloads(deadline: IdleDeadline) {
    idleHandle = undefined;
    if (cancelled) {
      return;
    }
    if (taskIndex >= componentPreloadTasks.length) {
      return;
    }
    if (!getCurrentVisibilityState()) {
      scheduleIdlePreload();
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
    clearVisibilityChangeSubscription();
  };
}
