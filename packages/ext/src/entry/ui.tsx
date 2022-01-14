// eslint-disable-next-line import/order
import './shared';

import hotReload from '../ui/hotReload';
import popupSizeFix from '../ui/popupSizeFix';
import renderApp from '../ui/renderApp';
import resizeEventOptimize from '../ui/resizeEventOptimize';
import uiJsBridge from '../ui/uiJsBridge';

function init() {
  uiJsBridge.init();

  popupSizeFix();

  // must be after popupSizeFix();
  resizeEventOptimize();

  renderApp();

  hotReload.enable();
}

export default { init };
