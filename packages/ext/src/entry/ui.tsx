/* eslint-disable import/order */
import './shared-polyfill';
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/polyfill';

import hotReload from '../ui/hotReload';
import renderApp from '../ui/renderApp';
import uiJsBridge from '../ui/uiJsBridge';

function init() {
  uiJsBridge.init();

  // popupSizeFix();
  // **** must be after popupSizeFix();
  // resizeEventOptimize();

  global.$$onekeyPerfTrace?.log({
    name: '[EXT]: ui.tsx init() / KitProviderExt render()',
  });
  renderApp();

  if (process.env.NODE_ENV !== 'production') {
    hotReload.enable();
  }
}

export default { init };
