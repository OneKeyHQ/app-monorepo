import JsBridgeBase from './JsBridgeBase';
import { IJsBridgeConfig, IJsBridgeMessagePayload } from '../types';
import messagePort from '../extension/extMessagePort';
import { EXT_PORT_UI_TO_BG } from '../consts';

class JsBridgeExtUi extends JsBridgeBase {
  constructor(config: IJsBridgeConfig) {
    super(config);
    this.setupMessagePortConnect();
  }

  sendAsString = false;

  private portToBg: chrome.runtime.Port | null = null;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    if (this.portToBg) {
      this.portToBg.postMessage(payload);
    }
  }

  setupMessagePortConnect() {
    messagePort.connect({
      name: EXT_PORT_UI_TO_BG,
      onMessage: (payload) => {
        this.receive(payload);
      },
      onConnect: (port) => {
        this.portToBg = port;
        return () => {
          this.portToBg = null;
        };
      },
    });
  }
}

export default JsBridgeExtUi;
