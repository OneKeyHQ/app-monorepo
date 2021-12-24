/* eslint-disable no-var,vars-on-top */
import { EnhancedStore } from '@reduxjs/toolkit/src/configureStore';
import WebView from 'react-native-webview';

import { WindowOneKeyHub } from '@onekeyhq/inpage-provider/src/injected/factory/injectWeb3Provider';
import JsBridgeBase from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeBase';

declare const self: ServiceWorkerGlobalScope;

declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

  var $backgroundApiProxy: any;
  var $backgroundApi: any;
  var $$appStore: EnhancedStore;
  var $$appDispatch: any;
  var $$appSelector: any;
  var $$platformEnv: any;

  interface Window {
    // All website
    ethereum: any;
    web3: any;
    $onekey: WindowOneKeyHub;

    // Native App webview content
    ReactNativeWebView: WebView;

    // Desktop internal (main,renderer)
    ONEKEY_DESKTOP_GLOBALS: Record<any, any>;

    // Ext internal (ui,background,contentScript)
    extJsBridgeUiToBg: JsBridgeBase;
    extJsBridgeUiToIframe: JsBridgeBase;
  }
}
