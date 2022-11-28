/* eslint-disable import/order */
import './shared-polyfill';

import hotReload from '../ui/hotReload';
import renderApp from '../ui/renderApp';
import uiJsBridge from '../ui/uiJsBridge';

function init() {
  uiJsBridge.init();

  renderApp();

  hotReload.enable();
}

export default { init };
