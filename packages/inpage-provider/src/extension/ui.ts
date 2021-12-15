// like injected + contentScript

import JsBridgeExtUi from '../jsBridge/JsBridgeExtUi';

function createUiJsBridge() {
  const bridge = new JsBridgeExtUi({});
  return bridge;
}

export default {
  createUiJsBridge,
};
