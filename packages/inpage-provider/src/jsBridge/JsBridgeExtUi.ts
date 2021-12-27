import { EXT_PORT_UI_TO_BG } from '../consts';
import messagePort from '../extension/extMessagePort';
import { IJsBridgeConfig, IJsBridgeMessagePayload } from '../types';

import JsBridgeBase from './JsBridgeBase';

export type IJsBridgeExtUiConfig = IJsBridgeConfig & {
  onPortConnect: (port0: chrome.runtime.Port) => void;
};

class JsBridgeExtUi extends JsBridgeBase {
  constructor(config: IJsBridgeExtUiConfig) {
    super(config as IJsBridgeConfig);
    this.setupMessagePortConnect(config);
  }

  sendAsString = false;

  private portToBg: chrome.runtime.Port | null = null;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    if (this.portToBg) {
      this.portToBg.postMessage(payload);
    }
  }

  setupMessagePortConnect(config: IJsBridgeExtUiConfig) {
    messagePort.connect({
      name: EXT_PORT_UI_TO_BG,
      onMessage: (payload) => {
        this.receive(payload);
      },
      onConnect: (port) => {
        this.portToBg = port;
        setTimeout(() => {
          config.onPortConnect(port);
        }, 0);
        return () => {
          this.portToBg = null;
        };
      },
    });
  }
}

export default JsBridgeExtUi;
