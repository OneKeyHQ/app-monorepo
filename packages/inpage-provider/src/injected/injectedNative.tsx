import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';
import injectedProviderReceiveHandler from '../provider/injectedProviderReceiveHandler';
import JsBridgeNativeInjected from '../jsBridge/JsBridgeNativeInjected';

// - send
const bridge = new JsBridgeNativeInjected({
  receiveHandler: injectedProviderReceiveHandler,
});
injectJsBridge(bridge);

injectWeb3Provider();
// - receive
// host executeJs `window.$onekey.jsBridge.receive()` directly
