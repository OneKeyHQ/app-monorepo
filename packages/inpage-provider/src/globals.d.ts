import WebView from 'react-native-webview';
import { WindowOneKey } from './types';

declare global {
  // eslint-disable-next-line
  // var onekey: WindowOneKey;

  interface Window {
    ethereum: any;
    web3: any;
    ReactNativeWebView: WebView;
    onekey: WindowOneKey;
  }
}
