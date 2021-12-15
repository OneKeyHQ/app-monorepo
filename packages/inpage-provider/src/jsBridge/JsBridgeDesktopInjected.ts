import { ipcRenderer } from 'electron';
import JsBridgeBase from './JsBridgeBase';
import { IJsBridgeMessagePayload } from '../types';
import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';

class JsBridgeDesktopInjected extends JsBridgeBase {
  sendAsString = true;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    console.log('[inpage] sendPayload: \n', payload);

    // send to renderer (webview host)
    ipcRenderer.sendToHost(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payload);

    // send to main
    // ipcRenderer.send(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payloadStr);
  }
}

export default JsBridgeDesktopInjected;
