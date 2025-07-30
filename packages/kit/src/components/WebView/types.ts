import type {
  DidFailLoadEvent,
  DidStartNavigationEvent,
  Event,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from './DesktopWebView';
import type { ESiteMode } from '../../views/Discovery/types';
import type { InpageProviderWebViewProps as InpageWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewNavigationEvent,
  WebViewSharedProps,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

type IFirstParameterOrUndefined<T> = T extends (
  first: infer P,
  ...rest: any[]
) => any
  ? P
  : never;

export type IWebViewOnScroll = WebViewSharedProps['onScroll'];

export type IWebViewOnScrollEvent =
  IFirstParameterOrUndefined<IWebViewOnScroll>;

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
  pullToRefreshEnabled?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
  onOpenWindow?: (event: any) => void;
  androidLayerType?: 'none' | 'software' | 'hardware';
  onLoadStart?: (event: WebViewNavigationEvent) => void;
  onLoad?: (event: WebViewNavigationEvent) => void;
  onLoadEnd?: (event: WebViewNavigationEvent | WebViewErrorEvent) => void;
  onScroll?: IWebViewOnScroll;
  displayProgressBar?: boolean;
  onProgress?: (progress: number) => void;
  /**
   * Enables WebView remote debugging using Chrome (Android) or Safari (iOS).
   * Only works in iOS and Android devices.
   */
  webviewDebuggingEnabled?: boolean;
  /** @platform native
   * @description Open website in desktop mode or mobile mode
   */
  siteMode?: ESiteMode;
  /** @platform native
   * @description A function that is invoked when the webview calls `window.ReactNativeWebView.postMessage`. Setting this property will inject this global into your webview.
   */
  onMessage?: (event: WebViewMessageEvent) => void;
  /** @platform android
   * @description Use GeckoView instead of the default WebView on Android. GeckoView is Mozilla's alternative to Android's WebView with better privacy and security features.
   */
  useGeckoView?: boolean;
  /** @platform native
   * @description Whether to use the injected native code from cross-inpage-provider-injected/dist/injected/injectedNative.js
   * @default true
   */
  useInjectedNativeCode?: boolean;
}

export type IWebViewRef = {
  sendMessageViaInjectedScript: (message: any) => void;
} & IWebViewWrapperRef;

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
  send: (channel: string, payload: any) => Promise<void>;
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
