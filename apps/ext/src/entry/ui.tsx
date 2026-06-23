// eslint-disable-next-line import-js/order
import '@onekeyhq/shared/src/polyfills';

// eslint-disable-next-line import-js/order
import { maybeLockdownOneKeyRuntime } from '@onekeyhq/shared/src/security/sesHarden';

function initUi() {
  const renderApp: typeof import('../ui/renderApp').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('../ui/renderApp').default;
  renderApp();
}

function initExtensionBridgeEarly() {
  const uiJsBridge: typeof import('../ui/uiJsBridge').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('../ui/uiJsBridge').default;
  uiJsBridge.init();
}

function setupUiRuntimeLate() {
  const platformEnv: typeof import('@onekeyhq/shared/src/platformEnv').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/platformEnv').default;

  if (platformEnv.isExtensionUiSidePanel) {
    const { setupSidePanelPortInUI } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../background/sidePanel') as typeof import('../background/sidePanel');
    setupSidePanelPortInUI();
  }
}

function enableHotReloadLate() {
  if (process.env.NODE_ENV !== 'production') {
    const hotReload: typeof import('../ui/hotReload').default =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
      require('../ui/hotReload').default;
    hotReload.enable();
  }
}

function installSesRuntimeCheckHandlerLate() {
  const { installSesHardenRuntimeCheckMessageHandler } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/security/sesHarden/runtimeCheck') as typeof import('@onekeyhq/shared/src/security/sesHarden/runtimeCheck');
  installSesHardenRuntimeCheckMessageHandler('ext-ui');
}

function init() {
  initExtensionBridgeEarly();

  maybeLockdownOneKeyRuntime({ runtime: 'ext-ui' });
  installSesRuntimeCheckHandlerLate();

  // popupSizeFix();
  // **** must be after popupSizeFix();
  // resizeEventOptimize();
  setupUiRuntimeLate();

  globalThis.$$onekeyPerfTrace?.log({
    name: '[EXT]: ui.tsx init() / KitProviderExt render()',
  });
  initUi();
  enableHotReloadLate();
}

export default { init };
