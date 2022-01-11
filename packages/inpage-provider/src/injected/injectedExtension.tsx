import JsBridgeExtInjected from '../jsBridge/JsBridgeExtInjected';
import injectedProviderReceiveHandler from '../provider/injectedProviderReceiveHandler';

import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

// - send
const bridge = new JsBridgeExtInjected({
  receiveHandler: injectedProviderReceiveHandler,
});
injectJsBridge(bridge);

injectWeb3Provider();
console.log(
  '======== injected.js in extension done! >>>>>>> ',
  performance.now(),
);

// FIX: Error evaluating injectedJavaScript: This is possibly due to an unsupported return type. Try adding true to the end of your injectedJavaScript string.
// eslint-disable-next-line no-void
void 0;
