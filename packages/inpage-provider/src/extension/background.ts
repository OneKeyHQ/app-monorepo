import { EXT_PORT_CS_TO_BG, EXT_PORT_UI_TO_BG } from '../consts';
import createBaseJsBridge from '../jsBridge/createJsBridgeBase';
import { IJsBridgeMessagePayload } from '../types';

let portIdIndex = 0;
const ports: Record<number | string, chrome.runtime.Port> = {};

// TODO one-time only
function createHostBridge() {
  const bridge = createBaseJsBridge({
    sendAsString: false,
    // #### background -> content-script
    sendPayload(payload0) {
      const payload = payload0 as IJsBridgeMessagePayload;
      if (!payload.remoteId) {
        return;
      }
      const port: chrome.runtime.Port = ports[payload.remoteId as string];
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
          console.log('onDisconnect handler');
        }
        throw error;
      }
    },
  });
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
      portIdIndex += 1;
      const portId = portIdIndex;
      ports[portId] = port;
      const onMessage = (payload: IJsBridgeMessagePayload) => {
        payload.remoteId = portId;
        // TODO if EXT_PORT_CS_TO_BG ignore "internal_" prefix methods
        //    ignore scope=walletPrivate
        bridge.receive(payload);
      };
      // #### content-script -> background
      port.onMessage.addListener(onMessage);

      // TODO onDisconnect remove ports cache
      const onDisconnect = () => {
        delete ports[portId];
        port.onMessage.removeListener(onMessage);
        port.onDisconnect.removeListener(onDisconnect);
      };
      port.onDisconnect.addListener(onDisconnect);
    }
  });
  return { bridge, ports };
}

export default {
  createHostBridge,
};
