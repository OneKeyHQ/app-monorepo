import platformEnv from '@onekeyhq/shared/src/platformEnv';
import inpageProviderBackground from '@onekeyhq/inpage-provider/src/extension/background';
import serviceWorker from '../background/serviceWorker';
import bgDappTest from '../background/backgroundDappTest';

console.log(
  `[OneKey RN] This is the background page. ${new Date().toLocaleTimeString()}`,
);
console.log('     Put the background scripts here. 222');

serviceWorker.disableCacheInBackground();

const bridge = inpageProviderBackground.createHostBridge({
  receiveHandler: bgDappTest.receiveHandler,
});

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
