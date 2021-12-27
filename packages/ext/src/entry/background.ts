import inpageProviderBackground from '@onekeyhq/inpage-provider/src/extension/background';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import serviceWorker from '../background/serviceWorker';

serviceWorker.disableCacheInBackground();

console.log(
  `[OneKey RN] Extension background page ready: ${new Date().toLocaleTimeString()}`,
);

const bridge = inpageProviderBackground.createHostBridge({
  receiveHandler: backgroundApiProxy.bridgeReceiveHandler,
});

backgroundApiProxy.connectBridge(bridge);

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
