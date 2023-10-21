import type { InpageProviderWebViewProps as InpageWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import type { WebViewSource } from 'react-native-webview/lib/WebViewTypes';

export interface InpageProviderWebViewProps extends InpageWebViewProps {
  id?: string;
  onNavigationStateChange?: (event: any) => void;
  onShouldStartLoadWithRequest?: (event: any) => boolean;
  allowpopups?: boolean;
  nativeWebviewSource?: WebViewSource;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
  onOpenWindow?: (event: any) => void;
  androidLayerType?: 'none' | 'software' | 'hardware';
}

export type IElectronWebView = {
  reload: () => void;
  loadURL: (...args: any) => void;
  closeDevTools: () => void;
  openDevTools: () => void;
  getURL: () => string;
  getTitle: () => string;
  src: string;
  addEventListener: (name: string, callback: unknown) => void;
  removeEventListener: (name: string, callback: unknown) => void;
  executeJavaScript: (code: string) => void;
  send: (channel: string, payload: any) => void;
  insertCSS: (css: string) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  stop: () => void;
};
