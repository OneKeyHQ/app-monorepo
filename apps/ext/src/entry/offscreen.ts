/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, import-js/order */
import '@onekeyhq/shared/src/polyfills';
import { maybeLockdownOneKeyRuntime } from '@onekeyhq/shared/src/security/sesHarden';

function initOffscreenBridgeEarly() {
  const { offscreenSetup } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../offscreen/offscreenSetup') as typeof import('../offscreen/offscreenSetup');
  return offscreenSetup();
}

function setupOffscreenRuntimeLate(
  offscreenBridge: ReturnType<typeof initOffscreenBridgeEarly>,
) {
  const { startKeepAlivePolling } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../background/keepAlive') as typeof import('../background/keepAlive');
  const timerUtils: typeof import('@onekeyhq/shared/src/utils/timerUtils').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/utils/timerUtils').default;

  // send a message every 20 sec to service worker
  startKeepAlivePolling();

  let timer: any = null;
  // background may be down or reloaded (like hot reloading)
  // so we need reconnect to background by reload offscreen page
  function checkPortEstablished() {
    // @ts-ignore
    if (!offscreenBridge?.portToBg) {
      clearInterval(timer);
      globalThis.location.reload();
    }
  }
  timer = setInterval(
    checkPortEstablished,
    timerUtils.getTimeDurationMs({ seconds: 5 }),
  );
}

function installSesRuntimeCheckHandlerLate() {
  const { installSesHardenRuntimeCheckMessageHandler } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/security/sesHarden/runtimeCheck') as typeof import('@onekeyhq/shared/src/security/sesHarden/runtimeCheck');
  installSesHardenRuntimeCheckMessageHandler('ext-offscreen');
}

const offscreenBridge = initOffscreenBridgeEarly();
maybeLockdownOneKeyRuntime({ runtime: 'ext-offscreen' });
installSesRuntimeCheckHandlerLate();
setupOffscreenRuntimeLate(offscreenBridge);
