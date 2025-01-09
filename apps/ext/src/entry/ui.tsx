// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/polyfills';

// eslint-disable-next-line import/order
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setupSidePanelPortInUI } from '../background/sidePanel';
import hotReload from '../ui/hotReload';
import uiJsBridge from '../ui/uiJsBridge';

function initUi() {
  const renderApp: typeof import('../ui/renderApp').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    require('../ui/renderApp').default;
  renderApp();
}

function init() {
  uiJsBridge.init();

  // popupSizeFix();
  // **** must be after popupSizeFix();
  // resizeEventOptimize();

  if (platformEnv.isExtensionUiSidePanel) {
    setupSidePanelPortInUI();
  }

  globalThis.$$onekeyPerfTrace?.log({
    name: '[EXT]: ui.tsx init() / KitProviderExt render()',
  });
  initUi();

  if (process.env.NODE_ENV !== 'production') {
    hotReload.enable();
  }
}

export default { init };
