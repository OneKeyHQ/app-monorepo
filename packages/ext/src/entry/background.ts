import inpageProvider from '@onekeyhq/inpage-provider/src/extension/background';
import {
  EXT_PORT_CS_TO_BG,
  EXT_PORT_UI_TO_BG,
} from '@onekeyhq/inpage-provider/src/consts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import serviceWorker from '../background/serviceWorker';
import bgDappTest from '../background/backgroundDappTest';

console.log(
  `[OneKey RN] This is the background page. ${new Date().toLocaleTimeString()}`,
);
console.log('     Put the background scripts here. 222');

serviceWorker.disableCacheInBackground();
const { bridge, ports } = inpageProvider.createHostBridge();

// TODO requestToAllDapps, requestToAllUi
bridge.requestToAllCS = (data: any) => {
  // TODO optimize
  Object.entries(ports).forEach(([portId, port]) => {
    if (port.name === EXT_PORT_CS_TO_BG) {
      console.log(`notify to content-script port: ${portId}`);
      // TODO check ports disconnected
      bridge.request(data, portId);
    }
  });
};

bridge.requestToAllUi = (data: any) => {
  // TODO optimize
  Object.entries(ports).forEach(([portId, port]) => {
    if (port.name === EXT_PORT_UI_TO_BG) {
      console.log(`notify to ui port: ${portId}`);
      // TODO check ports disconnected
      bridge.request(data, portId);
    }
  });
};

bgDappTest.init(bridge);

// extension reload() method expose to dapp
if (platformEnv.isDev) {
  chrome.runtime.onMessage.addListener(
    (
      message: { channel: string; method: string },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ) => {
      const { channel, method } = message ?? {};
      if (channel === 'EXTENSION_INTERNAL_CHANNEL') {
        console.log('chrome.runtime.onMessage', message);
        if (method === 'reload') {
          chrome.runtime.reload();
          // chrome.tabs.create({url: 'ui-popup.html'});
        }
        if (method === 'ping') {
          sendResponse({ pong: 'pong', ts: Date.now() });
        }
      }
    },
  );
}

export {};
