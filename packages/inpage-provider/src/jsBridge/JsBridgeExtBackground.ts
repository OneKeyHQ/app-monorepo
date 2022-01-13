import { EXT_PORT_CS_TO_BG, EXT_PORT_UI_TO_BG } from '../consts';
import {
  IInjectedProviderNamesStrings,
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
} from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeExtBackground extends JsBridgeBase {
  constructor(config: IJsBridgeConfig) {
    super(config);
    this.setupMessagePortOnConnect();
  }

  sendAsString = false;

  public ports: Record<number | string, chrome.runtime.Port> = {};

  private portIdIndex = 1;

  sendPayload(payload0: IJsBridgeMessagePayload | string): void {
    const payload = payload0 as IJsBridgeMessagePayload;
    if (!payload.remoteId) {
      return;
    }
    const port: chrome.runtime.Port = this.ports[payload.remoteId as string];
    // TODO onDisconnect remove ports cache
    //    try catch error test
    try {
      port.postMessage(payload);
    } catch (err: any) {
      const error = err as Error;
      // TODO message maybe different in browser
      if (
        error &&
        error?.message === 'Attempting to use a disconnected port object'
      ) {
        console.error('onDisconnect handler');
      }
      throw error;
    }
  }

  setupMessagePortOnConnect() {
    // TODO removeListener
    chrome.runtime.onConnect.addListener((port) => {
      /* port.sender
                  frameId: 0
                  id: "nhccmkonbhjkihmkjcodcepopkjpldoa"
                  origin: "https://app.uniswap.org"
                  tab: {active: true, audible: false, autoDiscardable: true, discarded: false, favIconUrl: 'https://app.uniswap.org/favicon.png', …}
                  url: "https://app.uniswap.org/#/swap"
             */
      // content-script may be multiple
      if (port.name === EXT_PORT_CS_TO_BG || port.name === EXT_PORT_UI_TO_BG) {
        this.portIdIndex += 1;
        const portId = this.portIdIndex;
        this.ports[portId] = port;
        const onMessage = (
          payload: IJsBridgeMessagePayload,
          port0: chrome.runtime.Port,
        ) => {
          const origin = port0.sender?.origin || '';
          payload.remoteId = portId;
          // TODO if EXT_PORT_CS_TO_BG ignore "internal_" prefix methods
          //    ignore scope=walletPrivate
          this.receive(payload, {
            origin,
            internal: port.name === EXT_PORT_UI_TO_BG,
          });
        };
        // #### content-script -> background
        port.onMessage.addListener(onMessage);

        // TODO onDisconnect remove ports cache
        const onDisconnect = () => {
          delete this.ports[portId];
          port.onMessage.removeListener(onMessage);
          port.onDisconnect.removeListener(onDisconnect);
        };
        port.onDisconnect.addListener(onDisconnect);
      }
    });
  }

  requestToAllCS(scope: IInjectedProviderNamesStrings, data: unknown) {
    // TODO optimize rename: broadcastRequest
    Object.entries(this.ports).forEach(([portId, port]) => {
      if (port.name === EXT_PORT_CS_TO_BG) {
        console.log(`notify to content-script port: ${portId}`, data);
        // TODO check ports disconnected
        this.requestSync({
          data,
          scope,
          remoteId: portId,
        });
      }
    });
  }

  requestToAllUi(data: unknown) {
    // TODO optimize
    Object.entries(this.ports).forEach(([portId, port]) => {
      if (port.name === EXT_PORT_UI_TO_BG) {
        console.log(`notify to ui port: ${portId}`);
        // TODO check ports disconnected
        this.requestSync({
          data,
          remoteId: portId,
        });
      }
    });
  }
}

export default JsBridgeExtBackground;
