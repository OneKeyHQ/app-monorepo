// eslint-disable-next-line import/order
import './shared-polyfill';
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/polyfill';

import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';
// @ts-ignore
import axiosAdapter from '@vespaiach/axios-fetch-adapter';
import axios from 'axios';
import urlParse from 'url-parse';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getExtensionIndexHtml } from '@onekeyhq/kit/src/routes/linking';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import serviceWorker from '../background/serviceWorker';

if (platformEnv.isExtensionBackgroundServiceWorker) {
  axios.defaults.adapter = axiosAdapter;
}

serviceWorker.disableCacheInBackground();

console.log(
  `[OneKey RN] Extension background page ready: ${new Date().toLocaleTimeString()}`,
);

const bridge = bridgeSetup.background.createHostBridge({
  receiveHandler: backgroundApiProxy.bridgeReceiveHandler,
});

backgroundApiProxy.connectBridge(bridge);

backgroundApiProxy.serviceNotification.init().catch((e) => {
  debugLogger.notification.error(`extension background init socket failed`, e);
});

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
          console.log(`
          ========================================
          >>>>>>> chrome.runtime.reload();
          ========================================
          `);
          chrome.runtime.reload();
        }
        if (method === 'ping') {
          sendResponse({ pong: 'pong', ts: Date.now() });
        }
      }
    },
  );
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const parsedUrl = urlParse(details.url);

    if (parsedUrl.pathname.includes('.')) return;
    let indexHtml = getExtensionIndexHtml();
    indexHtml = 'ui-expand-tab.html';
    const newUrl = chrome.runtime.getURL(
      `/${indexHtml}/#${parsedUrl.pathname}`,
    );

    return { redirectUrl: newUrl };
  },
  {
    urls: [chrome.runtime.getURL('*')],
  },
  ['blocking'],
);

export {};
