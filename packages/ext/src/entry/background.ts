// fix missing setimmediate
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/polyfills';

import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';
// @ts-ignore
import axiosAdapter from '@vespaiach/axios-fetch-adapter';
import axios from 'axios';
import urlParse from 'url-parse';

import offscreenApiProxy from '@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy';
import { getExtensionIndexHtml } from '@onekeyhq/kit/src/utils/extUtils.getHtml';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setupKeepAlive } from '../background/keepAlive';
import serviceWorker from '../background/serviceWorker';

function initBackground() {
  const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;

  const bridge = bridgeSetup.background.createHostBridge({
    receiveHandler: backgroundApiProxy.bridgeReceiveHandler,
  });
  backgroundApiProxy.connectBridge(bridge);
  backgroundApiProxy.serviceNotification.init().catch((e) => {
    debugLogger.notification.error(
      `extension background init socket failed`,
      e,
    );
  });
}

if (platformEnv.isExtensionBackgroundServiceWorker) {
  axios.defaults.adapter = axiosAdapter;
  setupKeepAlive();
  serviceWorker.disableCacheInBackground();
}
console.log(
  `[OneKey RN] Extension background page ready: 666  ${new Date().toLocaleTimeString()}`,
);
initBackground();

// extension reload() method expose to dapp
if (process.env.NODE_ENV !== 'production') {
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

/*
**** Manifest V3 not support [webRequestBlocking] permission
You do not have permission to use blocking webRequest listeners. Be sure to declare the webRequestBlocking permission in your manifest.
 */
if (!platformEnv.isManifestV3) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const parsedUrl = urlParse(details.url);

      if (parsedUrl.pathname.includes('.')) return;
      let indexHtml = getExtensionIndexHtml();
      indexHtml = 'ui-expand-tab.html';
      /*
        check chrome.webRequest.onBeforeRequest
         /ui-expand-tab.html/#/   not working for Windows Chrome
         /ui-expand-tab.html#/    works fine
      */
      const newUrl = chrome.runtime.getURL(
        `/${indexHtml}#${parsedUrl.pathname}${parsedUrl.query}`,
      );

      return { redirectUrl: newUrl };
    },
    {
      urls: [chrome.runtime.getURL('*')],
    },
    ['blocking'],
  );
}

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$offscreenApiProxy = offscreenApiProxy;
  offscreenApiProxy.adaSdk.sayHello().then(console.log);
  offscreenApiProxy.xmrSdk.showMe().then(console.log);
}

export {};
