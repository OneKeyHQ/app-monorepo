import WebView from 'react-native-webview';
import { IJsBridge, WindowOneKey } from './types';

declare const self: ServiceWorkerGlobalScope;

declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

  interface Window {
    // All website
    ethereum: any;
    web3: any;
    ReactNativeWebView: WebView;
    onekey: WindowOneKey;

    // Desktop internal (main,renderer)
    ONEKEY_DESKTOP_GLOBALS: Record<any, any>;

    // Ext internal (ui,background,contentScript)
    extJsBridgeUiToBg: IJsBridge;
    extJsBridgeUiToIframe: IJsBridge;
  }
}
