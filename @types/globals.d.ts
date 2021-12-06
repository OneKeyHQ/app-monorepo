import WebView from 'react-native-webview';
import { WindowOneKey } from './types';

declare const self: ServiceWorkerGlobalScope;

declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

  interface Window {
    portUiToBg: any;
    ethereum: any;
    web3: any;
    ReactNativeWebView: WebView;
    onekey: WindowOneKey;
    ONEKEY_DESKTOP_GLOBALS: Record<any, any>;
  }
}
