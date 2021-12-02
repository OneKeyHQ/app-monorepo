import { ipcRenderer } from 'electron';
import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';
import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

ipcRenderer.on('SET_ONEKEY_DESKTOP_GLOBALS', (_, globals: Record<any, any>) => {
  // for DesktopWebView:
  //    const { preloadJsUrl } = window.ONEKEY_DESKTOP_GLOBALS;
  window.ONEKEY_DESKTOP_GLOBALS = globals;
});

// - send
injectJsBridge({
  createBridge: () =>
    createJsBridgeInpage({
      // inpage -> host
      sendPayload: (payloadStr) => {
        console.log('[inpage] sendPayload: \n', payloadStr);

        // send to renderer (webview host)
        ipcRenderer.sendToHost(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payloadStr);

        // send to main
        // ipcRenderer.send(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payloadStr);
      },
    }),
});

// - receive
// host executeJs `window.onekey.jsBridge.receive()` directly

injectWeb3Provider();
