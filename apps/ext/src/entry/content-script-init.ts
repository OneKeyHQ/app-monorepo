// eslint-disable-next-line import-js/order
// oxlint-disable-next-line import-js/order
import '@onekeyhq/shared/src/polyfills/polyfillsExtContentScript';

// inject css to dapp web
// import './content-script.css';

// injected hot-reload cache update:  1111222

import { consts } from '@onekeyfe/cross-inpage-provider-core';
import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

// import type { IOneKeyWalletInfo } from '@onekeyhq/kit-bg/src/providers/ProviderApiPrivate';
import {
  type IKeylessWebOpenSidePanelMessage,
  type IKeylessWebOpenSidePanelPayload,
  KEYLESS_WEB_OPEN_SIDE_PANEL_EVENT,
  KEYLESS_WEB_OPEN_SIDE_PANEL_MESSAGE_TYPE,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import {
  isKeylessWebAutoConnectOriginAllowed,
  isKeylessWebConnectAlertMessage,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import { startKeepAlivePolling } from '../background/keepAlive';
// oxlint-disable-next-line import-js/order
import devToolsButton from '../content-script/devToolsButton';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { shouldInject } from '../content-script/shouldInject';

// @ts-ignore
import injectedCode from './injected.text-js';

if (process.env.NODE_ENV !== 'production') {
  console.log('==== injected script tag start >>>>>>>', performance.now());
  console.log('[OneKey RN]: Content script works! ', globalThis.location.href);
  console.log('   Must reload extension for modifications to take effect.');
}

if (platformEnv.isManifestV3) {
  // keep-alive polling moved to offscreen.html
  // startKeepAlivePolling();
}

let removeScriptTagAfterInject = true;
if (process.env.NODE_ENV !== 'production') {
  removeScriptTagAfterInject = false;
}

if (shouldInject()) {
  if (platformEnv.isManifestV3) {
    if (process.env.EXT_INJECT_MODE !== 'fileScript') {
      // **** inject MAIN world injected.js JS has been defined in manifest.json, runtime injecting is not needed.
      // do nothing here
    } else {
      bridgeSetup.contentScript.inject({
        file: `injected.js?${Date.now()}`,
        remove: removeScriptTagAfterInject,
      });
    }
  } else {
    // bridgeSetup.contentScript.inject({ file: 'injected.js' });
    bridgeSetup.contentScript.inject({
      code: injectedCode,
      remove: removeScriptTagAfterInject,
    });
  }
}

bridgeSetup.contentScript.setupMessagePort();

globalThis.addEventListener(
  KEYLESS_WEB_OPEN_SIDE_PANEL_EVENT,
  (event: Event) => {
    if (globalThis.top !== globalThis.self) {
      return;
    }
    if (!isKeylessWebAutoConnectOriginAllowed(globalThis.location.href)) {
      return;
    }

    const customEvent = event as CustomEvent<IKeylessWebOpenSidePanelPayload>;
    const message: IKeylessWebOpenSidePanelMessage = {
      type: KEYLESS_WEB_OPEN_SIDE_PANEL_MESSAGE_TYPE,
      payload: customEvent?.detail,
    };
    void chrome.runtime
      ?.sendMessage?.(message)
      .catch((error: unknown) =>
        console.error('keyless_open_side_panel_send_message', error),
      );
  },
);

chrome.runtime?.onMessage.addListener((message) => {
  if (!isKeylessWebConnectAlertMessage(message)) {
    return undefined;
  }
  if (globalThis.top !== globalThis.self) {
    return undefined;
  }

  const targetOrigin = globalThis.location?.origin || '*';
  globalThis.postMessage(message, targetOrigin);
  return undefined;
});

export interface IOneKeyWalletInfo {
  enableExtContentScriptReloadButton?: boolean;
  platform?: string;
  version?: string;
  buildNumber?: string;
  disableExt: boolean;
  walletSwitchConfig: Record<string, string[]>;
  isLegacy: boolean;
  platformEnv: {
    isRuntimeBrowser?: boolean;
    isRuntimeChrome?: boolean;
    isRuntimeFirefox?: boolean;

    isWeb?: boolean;

    isNative?: boolean;
    isNativeIOS?: boolean;
    isNativeAndroid?: boolean;

    isExtension?: boolean;
    isExtChrome?: boolean;
    isExtFirefox?: boolean;

    isDesktop?: boolean;
    isDesktopWin?: boolean;
    isDesktopLinux?: boolean;
    isDesktopMac?: boolean;
  };
}

if (process.env.NODE_ENV !== 'production') {
  try {
    if (consts.WALLET_INFO_LOACAL_KEY_V5) {
      const walletInfo: IOneKeyWalletInfo = JSON.parse(
        localStorage.getItem(consts.WALLET_INFO_LOACAL_KEY_V5) || '{}',
      );
      console.log(walletInfo);
      if (walletInfo && walletInfo.enableExtContentScriptReloadButton) {
        setTimeout(() => {
          devToolsButton.inject();
        }, 2000);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

if (process.env.NODE_ENV !== 'production') {
  console.log('==== injected script tag done >>>>>>>', performance.now());
}

// oxlint-disable-next-line unicorn/require-module-specifiers, @typescript-eslint/no-useless-empty-export
export {};
