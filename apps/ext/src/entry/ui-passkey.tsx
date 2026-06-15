import '@onekeyhq/shared/src/performance/init';
import '@onekeyhq/shared/src/polyfills';
import { maybeLockdownOneKeyRuntime } from '@onekeyhq/shared/src/security/sesHarden';

function initPasskeyBridgeEarly() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const uiJsBridge = require('../ui/uiJsBridge')
    .default as typeof import('../ui/uiJsBridge').default;

  uiJsBridge.init();
}

function setupPasskeyRuntimeLate() {
  const { closeWindow } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../closePasskeyWIndow') as typeof import('../closePasskeyWIndow');

  const activeTimeAt = Date.now();
  console.log('activeTimeAt', activeTimeAt);
  const maxActiveTime = 5 * 60 * 1000;
  const checkInterval = setInterval(() => {
    const currentTime = Date.now();
    if (currentTime - activeTimeAt >= maxActiveTime) {
      clearInterval(checkInterval);
      closeWindow();
    }
  }, 10);

  // Close the page after 5 minutes when the page is focused
  window.addEventListener('focus', () => {
    const currentTime = Date.now();
    if (currentTime - activeTimeAt >= maxActiveTime) {
      closeWindow();
    }
  });
}

function installSesRuntimeCheckHandlerLate() {
  const { installSesHardenRuntimeCheckMessageHandler } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/security/sesHarden/runtimeCheck') as typeof import('@onekeyhq/shared/src/security/sesHarden/runtimeCheck');
  installSesHardenRuntimeCheckMessageHandler('ext-passkey');
}

initPasskeyBridgeEarly();
maybeLockdownOneKeyRuntime({ runtime: 'ext-passkey' });
installSesRuntimeCheckHandlerLate();
setupPasskeyRuntimeLate();

const renderApp: typeof import('../ui/renderPassKeyPage').default =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  require('../ui/renderPassKeyPage').default;

renderApp();
