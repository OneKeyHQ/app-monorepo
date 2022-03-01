/* eslint-disable no-var,vars-on-top */
import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { EnhancedStore } from '@reduxjs/toolkit/src/configureStore';
import WebView from 'react-native-webview';

import { IBackgroundApi } from '@onekeyhq/kit/src/background/BackgroundApiProxy';

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
