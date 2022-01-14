import JsBridgeDesktopInjected from '../jsBridge/JsBridgeDesktopInjected';
import injectedProviderReceiveHandler from '../provider/injectedProviderReceiveHandler';

import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

const bridge = new JsBridgeDesktopInjected({
  receiveHandler: injectedProviderReceiveHandler,
});
injectJsBridge(bridge);

injectWeb3Provider();
