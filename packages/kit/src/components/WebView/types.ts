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
  WebViewHttpErrorEvent,
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
  extends IElectronWebViewEvents, InpageWebViewProps {
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
  onError?: (event: WebViewErrorEvent) => void;
  onHttpError?: (event: WebViewHttpErrorEvent) => void;
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
  /** @platform ios
   * @description Whether to allow back/forward navigation gestures (swipe to go back/forward)
   * @default true
   */
  allowsBackForwardNavigationGestures?: boolean;
  /** @platform android
   * @description Allow file access from file URLs
   * @default false
   */
  allowFileAccessFromFileURLs?: boolean;
  /** @platform android
   * @description Allow file access
   * @default false
   */
  allowFileAccess?: boolean;
  /** @platform ios
   * @description URL string that specifies the directory WKWebView can read from when loading local file URLs.
   */
  allowingReadAccessToURL?: string;
  /** @platform native
   * @description Whitelisted origins that may request camera or microphone access.
   */
  mediaPermissionWhitelist?: string[];
  /** Disable OneKey inpage provider injection and bridge connection.
   * Use for content-only WebViews (e.g. WebView overlay from deeplink/notification)
   * that must not be treated as DApp pages.
   * - Native: skips injectedNativeCode (overrides useInjectedNativeCode to false)
   * - Desktop: skips preload script and backgroundApiProxy.connectBridge()
   */
  disableBridge?: boolean;
  /** @platform desktop
   * @description Electron <webview> partition string. Defaults to the shared
   * Discovery / wallet partition. Overlay pages opened from deeplink /
   * notification use a dedicated partition so the desktop main process can
   * tag the contents id at `web-contents-created` time — before any
   * navigation event can fire — and apply the strict overlay URL policy in
   * `will-redirect` / `will-navigate` without renderer registration races.
   */
  partition?: string;
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
  getWebContentsId: () => number;
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
