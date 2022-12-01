/* eslint-disable import/order */
import './shared-polyfill';

import hotReload from '../ui/hotReload';
import renderApp from '../ui/renderApp';
import uiJsBridge from '../ui/uiJsBridge';

function init() {
  uiJsBridge.init();

  // popupSizeFix();
  // **** must be after popupSizeFix();
  // resizeEventOptimize();

  renderApp();

  if (process.env.NODE_ENV !== 'production') {
    hotReload.enable();
  }
}

export default { init };
