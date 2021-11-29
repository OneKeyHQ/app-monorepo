import { ipcRenderer } from 'electron';
import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';
import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

ipcRenderer.on('SET_ONEKEY_DESKTOP_GLOBALS', (_, globals: Record<any, any>) => {
  window.ONEKEY_DESKTOP_GLOBALS = globals;
});

injectJsBridge({
  createBridge: () =>
    createJsBridgeInpage({
      // inpage -> host
      sendPayload: (payloadStr) => {
        console.log('[inpage] sendPayload: \n', payloadStr);

        ipcRenderer.sendToHost(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payloadStr);
        // ipcRenderer.send(JS_BRIDGE_MESSAGE_CHANNEL, payloadStr);
      },
    }),
});
injectWeb3Provider();
