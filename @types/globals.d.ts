/* eslint-disable no-var,vars-on-top */
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { IBackgroundApi } from '@onekeyhq/kit/src/background/IBackgroundApi';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { EnhancedStore } from '@reduxjs/toolkit';
import type WebView from 'react-native-webview';

declare const self: ServiceWorkerGlobalScope;

declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

  var $onekey: any;
  var $backgroundApiProxy: IBackgroundApi;
  var $backgroundApi: any;
  var $$appStore: EnhancedStore;
  var $$appDispatch: any;
  var $$appSelector: any;
  var $$appStorage: any;
  var $$platformEnv: any;
  var $$debugLogger: any;

  var chrome: typeof chrome; // chrome api
  var browser: typeof chrome; // firefox api

  interface Window {
    // All website
    ethereum: any;
    web3: any;
    $onekey: any;

    // Native App webview content
    ReactNativeWebView: WebView;

    // Desktop internal (main,renderer)
    // ONEKEY_DESKTOP_GLOBALS: Record<any, any>;

    // Ext internal (ui,background,contentScript)
    extJsBridgeUiToBg: JsBridgeBase;
    extJsBridgeUiToIframe: JsBridgeBase;
  }
}

declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: LocaleIds;
    }
  }
}
