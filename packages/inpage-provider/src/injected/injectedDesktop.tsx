import { ipcRenderer } from 'electron';
import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';
import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

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
