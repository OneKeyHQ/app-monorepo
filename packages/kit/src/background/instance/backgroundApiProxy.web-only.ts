import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import appGlobals from '@onekeyhq/shared/src/appGlobals';

let backgroundApiPromise: Promise<IBackgroundApi> | undefined;

const WEB_BACKGROUND_API_IDLE_TIMEOUT_BASE_MS = 1000;
const WEB_BACKGROUND_API_IDLE_TIMEOUT_JITTER_MS = 2000;
const WEB_BACKGROUND_API_IMMEDIATE_PATH_PREFIXES = [
  '/',
  '/wallet',
  '/url-account',
  '/market',
  '/swap',
  '/perp',
  '/perps',
];

type IIdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IGlobalWithIdleCallback = typeof globalThis & {
  requestIdleCallback?: (
    callback: (deadline: IIdleDeadline) => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const getWebBackgroundApiIdleTimeoutMs = () =>
  WEB_BACKGROUND_API_IDLE_TIMEOUT_BASE_MS +
  Math.floor(Math.random() * (WEB_BACKGROUND_API_IDLE_TIMEOUT_JITTER_MS + 1));

const shouldStartWebBackgroundApiImmediately = () => {
  const pathname = globalThis.location?.pathname;
  if (!pathname) {
    return false;
  }
  return WEB_BACKGROUND_API_IMMEDIATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
};

const scheduleAfterNextPaint = (callback: () => void) => {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  }

  let firstFrame: number | undefined;
  let secondFrame: number | undefined;

  firstFrame = globalThis.requestAnimationFrame(() => {
    firstFrame = undefined;
    secondFrame = globalThis.requestAnimationFrame(() => {
      secondFrame = undefined;
      callback();
    });
  });

  return () => {
    if (typeof globalThis.cancelAnimationFrame !== 'function') {
      return;
    }
    if (firstFrame !== undefined) {
      globalThis.cancelAnimationFrame(firstFrame);
      firstFrame = undefined;
    }
    if (secondFrame !== undefined) {
      globalThis.cancelAnimationFrame(secondFrame);
      secondFrame = undefined;
    }
  };
};

const createWebBackgroundApiStartPromise = () => {
  if (typeof globalThis.addEventListener !== 'function') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const idleTimeoutMs = getWebBackgroundApiIdleTimeoutMs();
    const globalWithIdleCallback = globalThis as IGlobalWithIdleCallback;
    let settled = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let idleHandle: number | undefined;
    let cleanupAfterNextPaint: (() => void) | undefined;

    const cleanup = () => {
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
      if (
        idleHandle !== undefined &&
        typeof globalWithIdleCallback.cancelIdleCallback === 'function'
      ) {
        globalWithIdleCallback.cancelIdleCallback(idleHandle);
        idleHandle = undefined;
      }
      cleanupAfterNextPaint?.();
      cleanupAfterNextPaint = undefined;
      globalThis.removeEventListener('pointerdown', onInteraction);
      globalThis.removeEventListener('keydown', onInteraction);
      globalThis.removeEventListener('touchstart', onInteraction);
    };

    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };

    function onInteraction() {
      done();
    }

    globalThis.addEventListener('pointerdown', onInteraction, {
      once: true,
      passive: true,
    });
    globalThis.addEventListener('keydown', onInteraction, { once: true });
    globalThis.addEventListener('touchstart', onInteraction, {
      once: true,
      passive: true,
    });

    if (typeof globalWithIdleCallback.requestIdleCallback === 'function') {
      idleHandle = globalWithIdleCallback.requestIdleCallback(() => done(), {
        timeout: idleTimeoutMs,
      });
      return;
    }

    cleanupAfterNextPaint = scheduleAfterNextPaint(done);
    timeoutTimer = setTimeout(done, idleTimeoutMs);
  });
};

const webBackgroundApiStartPromise = createWebBackgroundApiStartPromise();

const waitForWebBackgroundApiStart = () => {
  if (shouldStartWebBackgroundApiImmediately()) {
    return Promise.resolve();
  }

  return webBackgroundApiStartPromise;
};

const loadBackgroundApi = () => {
  const promise = import('./backgroundApiInit')
    .then(({ default: backgroundApiInit }) => backgroundApiInit())
    .catch((error: unknown) => {
      if (backgroundApiPromise === promise) {
        backgroundApiPromise = undefined;
      }
      throw error;
    });
  backgroundApiPromise = promise;
  return promise;
};

const getBackgroundApi = async () => {
  await waitForWebBackgroundApiStart();
  return backgroundApiPromise ?? loadBackgroundApi();
};

const backgroundApiProxy = new BackgroundApiProxy({
  getBackgroundApi,
});

appGlobals.$backgroundApiProxy = backgroundApiProxy;

void import('@onekeyhq/kit-bg/src/states/jotai/jotaiInit')
  .then(({ jotaiInit }) => jotaiInit())
  .catch(async (error: unknown) => {
    console.error('jotaiInit failed on web startup', error);
    const { globalJotaiStorageReadyHandler } =
      await import('@onekeyhq/kit-bg/src/states/jotai/jotaiStorage');
    globalJotaiStorageReadyHandler.resolveReady(true);
  });

export default backgroundApiProxy;
