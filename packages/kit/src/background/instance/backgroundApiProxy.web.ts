import BackgroundApiProxy from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxy';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import appGlobals from '@onekeyhq/shared/src/appGlobals';

let backgroundApiPromise: Promise<IBackgroundApi> | undefined;

const WEB_BACKGROUND_API_START_DELAY_MS = 2000;
const WEB_BACKGROUND_API_IMMEDIATE_PATH_PREFIXES = ['/swap', '/perp', '/perps'];

const getNow = () =>
  typeof globalThis.performance !== 'undefined'
    ? globalThis.performance.now()
    : Date.now();

const webBackgroundApiProxyCreatedAt = getNow();

let resolveUserInteraction: (() => void) | undefined;

const userInteractionPromise =
  typeof globalThis.addEventListener === 'function'
    ? new Promise<void>((resolve) => {
        const onInteraction = () => {
          resolveUserInteraction?.();
          resolveUserInteraction = undefined;
          globalThis.removeEventListener('pointerdown', onInteraction);
          globalThis.removeEventListener('keydown', onInteraction);
          globalThis.removeEventListener('touchstart', onInteraction);
        };

        resolveUserInteraction = resolve;
        globalThis.addEventListener('pointerdown', onInteraction, {
          once: true,
          passive: true,
        });
        globalThis.addEventListener('keydown', onInteraction, { once: true });
        globalThis.addEventListener('touchstart', onInteraction, {
          once: true,
          passive: true,
        });
      })
    : Promise.resolve();

const shouldStartWebBackgroundApiImmediately = () => {
  const pathname = globalThis.location?.pathname;
  if (!pathname) {
    return false;
  }
  return WEB_BACKGROUND_API_IMMEDIATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
};

const waitForWebBackgroundApiStart = () => {
  if (shouldStartWebBackgroundApiImmediately()) {
    return Promise.resolve();
  }

  const remainingMs = Math.max(
    0,
    WEB_BACKGROUND_API_START_DELAY_MS -
      (getNow() - webBackgroundApiProxyCreatedAt),
  );

  if (remainingMs <= 0) {
    return Promise.resolve();
  }

  return Promise.race([
    userInteractionPromise,
    new Promise<void>((resolve) => setTimeout(resolve, remainingMs)),
  ]);
};

const getBackgroundApi = async () => {
  await waitForWebBackgroundApiStart();
  backgroundApiPromise ??= import('./backgroundApiInit').then(
    ({ default: backgroundApiInit }) => backgroundApiInit(),
  );
  return backgroundApiPromise;
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
