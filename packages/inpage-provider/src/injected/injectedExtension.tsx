import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';
import JsBridgeExtInjected from '../jsBridge/JsBridgeExtInjected';
import injectedProviderReceiveHandler from '../provider/injectedProviderReceiveHandler';

// - send
const bridge = new JsBridgeExtInjected({
  receiveHandler: injectedProviderReceiveHandler,
});
injectJsBridge(bridge);

injectWeb3Provider();
console.log('============== injected.js in extension done!  111');
