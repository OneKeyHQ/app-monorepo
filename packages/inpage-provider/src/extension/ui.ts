// like injected + contentScript

import JsBridgeExtUi, { IJsBridgeExtUiConfig } from '../jsBridge/JsBridgeExtUi';

function createUiJsBridge(config: IJsBridgeExtUiConfig) {
  const bridge = new JsBridgeExtUi(config);
  return bridge;
}

export default {
  createUiJsBridge,
};
