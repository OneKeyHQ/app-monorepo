import type {
  DidFailLoadEvent,
  DidStartNavigationEvent,
  Event,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from './DesktopWebView';
import type { InpageProviderWebViewProps as InpageWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import type {
  WebViewErrorEvent,
  WebViewNavigationEvent,
  WebViewSharedProps,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

export interface IInpageProviderWebViewProps
  extends IElectronWebViewEvents,
    InpageWebViewProps {
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
  onLoadStart?: (event: WebViewNavigationEvent) => void;
  onLoad?: (event: WebViewNavigationEvent) => void;
  onLoadEnd?: (event: WebViewNavigationEvent | WebViewErrorEvent) => void;
  onScroll?: WebViewSharedProps['onScroll'];
  webviewHeight?: number;
  displayProgressBar?: boolean;
  onProgress?: (progress: number) => void;
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
  setUserAgent: (userAgent: string) => void;
  getUserAgent: () => string;
};

export type IElectronWebViewEventNames =
  | 'did-start-loading'
  | 'did-start-navigation'
  | 'did-finish-load'
  | 'did-stop-loading'
  | 'did-fail-load'
  | 'page-title-updated'
  | 'page-favicon-updated'
  | 'new-window'
  | 'dom-ready';

export type IElectronWebViewEvents = {
  onDidStartLoading?: (e: Event) => void;
  onDidStartNavigation?: (e: DidStartNavigationEvent) => void;
  onDidFinishLoad?: () => void;
  onDidStopLoading?: () => void;
  onDidFailLoad?: (e: DidFailLoadEvent) => void;
  onPageTitleUpdated?: (e: PageTitleUpdatedEvent) => void;
  onPageFaviconUpdated?: (e: PageFaviconUpdatedEvent) => void;
  onDomReady?: (e: Event) => void;
};
