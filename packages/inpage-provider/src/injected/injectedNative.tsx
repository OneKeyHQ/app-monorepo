import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

injectJsBridge({
  createBridge: () =>
    createJsBridgeInpage({
      // inpage -> host
      sendPayload: (payloadStr) => {
        window.ReactNativeWebView.postMessage(payloadStr);
      },
    }),
});
injectWeb3Provider();
