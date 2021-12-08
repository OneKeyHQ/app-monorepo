// like injected + contentScript

import messagePort from './messagePort';
import { EXT_PORT_UI_TO_BG } from '../consts';
import createJsBridgeBase from '../jsBridge/createJsBridgeBase';
import { IJsBridge } from '../types';

let portToBg: chrome.runtime.Port | null;
let bridge: IJsBridge | null;

function setupMessagePort() {
  messagePort.connect({
    name: EXT_PORT_UI_TO_BG,
    onMessage(payload) {
      if (bridge) {
        bridge.receive(payload);
      }
    },
    onConnect(port) {
      portToBg = port;
      return () => {
        portToBg = null;
      };
    },
  });
}

function createUiJsBridge() {
  setupMessagePort();

  bridge = createJsBridgeBase({
    sendAsString: false,
    sendPayload(payload) {
      if (portToBg) {
        portToBg.postMessage(payload);
      }
    },
  });

  return bridge;
}

export default {
  createUiJsBridge,
};
