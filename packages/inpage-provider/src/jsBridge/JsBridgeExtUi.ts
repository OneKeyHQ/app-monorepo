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
      // #### background -> ui
      onMessage: (payload: any, port0: chrome.runtime.Port) => {
        let origin = port0.sender?.origin || '';

        // in ext ui, port.sender?.origin is always empty,
        //    so we trust remote (background) origin
        origin = origin || (payload as IJsBridgeMessagePayload).origin || '';

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const jsBridge = this;
        jsBridge.receive(payload, {
          origin,
          // trust message from background
          internal: port0.name === EXT_PORT_UI_TO_BG,
        });
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
