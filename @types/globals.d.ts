import WebView from 'react-native-webview';
import { WindowOneKeyHub } from '@onekeyhq/inpage-provider/src/injected/factory/injectWeb3Provider';
import JsBridgeBase from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeBase';

declare const self: ServiceWorkerGlobalScope;

declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

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
