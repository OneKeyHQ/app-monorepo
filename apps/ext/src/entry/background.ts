/* eslint-disable import-js/order */
// fix missing setimmediate
import 'setimmediate';

import '@onekeyhq/shared/src/polyfills';

import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import { maybeLockdownOneKeyRuntime } from '@onekeyhq/shared/src/security/sesHarden';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

function initBackgroundBridgeEarly() {
  // TODO use backgroundApiInit
  const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;

  const bridge = bridgeSetup.background.createHostBridge({
    receiveHandler: backgroundApiProxy.bridgeReceiveHandler,
  });
  backgroundApiProxy.connectBridge(bridge as unknown as JsBridgeBase);
  // backgroundApiProxy.serviceNotification.init().catch((e) => {
  //   debugLogger.notification.error(
  //     `extension background init socket failed`,
  //     e,
  //   );
  // });
}

function installOffscreenApiProxyEarly() {
  const appGlobals: typeof import('@onekeyhq/shared/src/appGlobals').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/appGlobals').default;
  const offscreenApiProxy: typeof import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy').default;

  appGlobals.$offscreenApiProxy = offscreenApiProxy;
  return offscreenApiProxy;
}

function installDevReloadListenerLate() {
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
}

function setupManifestV2RedirectLate() {
  const platformEnv: typeof import('@onekeyhq/shared/src/platformEnv').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/platformEnv').default;

  /*
  **** Manifest V3 not support [webRequestBlocking] permission
  You do not have permission to use blocking webRequest listeners. Be sure to declare the webRequestBlocking permission in your manifest.
   */
  if (!platformEnv.isManifestV3) {
    const urlParse =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('url-parse') as (url: string) => {
        pathname: string;
        query: string;
      };
    const { getExtensionIndexHtml } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/utils/extUtils') as typeof import('@onekeyhq/shared/src/utils/extUtils');

    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        const parsedUrl = urlParse(details.url);

        if (parsedUrl.pathname.includes('.')) return;
        let indexHtml = getExtensionIndexHtml();
        indexHtml = 'ui-expand-tab.html';
        const newUrl = chrome.runtime.getURL(
          `/${indexHtml}/#${parsedUrl.pathname}${parsedUrl.query}`,
        );

        return { redirectUrl: newUrl };
      },
      {
        urls: [chrome.runtime.getURL('*')],
      },
      ['blocking'],
    );
  }
}

function setupServiceWorkerRuntimeLate() {
  const platformEnv: typeof import('@onekeyhq/shared/src/platformEnv').default =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/platformEnv').default;

  if (platformEnv.isExtensionBackgroundServiceWorker) {
    const { setupKeepAlive } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../background/keepAlive') as typeof import('../background/keepAlive');
    const { setupSidePanelPortInBg } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../background/sidePanel') as typeof import('../background/sidePanel');
    const keylessWebBridge: typeof import('@onekeyhq/shared/src/keylessWallet/keylessWebBridge').default =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/keylessWallet/keylessWebBridge').default;
    const { setupExtUIEvent } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../background/extUI') as typeof import('../background/extUI');
    const serviceWorker: typeof import('../background/serviceWorker').default =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
      require('../background/serviceWorker').default;

    // axios.defaults.adapter = axiosAdapter;
    setupKeepAlive();
    setupSidePanelPortInBg();
    keylessWebBridge.setupKeylessWebBridgeInBackground();
    setupExtUIEvent();
    serviceWorker.disableCacheInBackground();
  }
}

function installSesRuntimeCheckHandlerLate() {
  const { installSesHardenRuntimeCheckMessageHandler } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/security/sesHarden/runtimeCheck') as typeof import('@onekeyhq/shared/src/security/sesHarden/runtimeCheck');
  installSesHardenRuntimeCheckMessageHandler('ext-background');
}

initBackgroundBridgeEarly();
const offscreenApiProxy = installOffscreenApiProxyEarly();
maybeLockdownOneKeyRuntime({ runtime: 'ext-background' });
installSesRuntimeCheckHandlerLate();

console.log(
  `[OneKey RN] Extension background page ready: 666  ${new Date().toLocaleTimeString()}`,
);
setupServiceWorkerRuntimeLate();
installDevReloadListenerLate();
setupManifestV2RedirectLate();

if (process.env.NODE_ENV !== 'production') {
  void offscreenApiProxy.adaSdk.sayHello().then(console.log);
}
// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
