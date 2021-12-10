import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

// - send
injectJsBridge({
  createBridge: () =>
    createJsBridgeInpage({
      // inpage -> host
      sendPayload: (payloadStr) => {
        window.ReactNativeWebView.postMessage(payloadStr as string);
      },
    }),
});

// - receive
// host executeJs `window.onekey.jsBridge.receive()` directly

injectWeb3Provider();
