import { ipcRenderer } from 'electron';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';
import { IJsBridgeMessagePayload } from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeDesktopInjected extends JsBridgeBase {
  sendAsString = true;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    // send to renderer (webview host)
    ipcRenderer.sendToHost(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payload);
    debugLogger.desktopInjected(
      'ipcRenderer.sendToHost',
      JS_BRIDGE_MESSAGE_IPC_CHANNEL,
      payload,
    );

    // send to main
    // ipcRenderer.send(JS_BRIDGE_MESSAGE_IPC_CHANNEL, payloadStr);
  }
}

export default JsBridgeDesktopInjected;
