import type { EWebEmbedRoutePath } from '../consts/webEmbedConsts';

export enum EModalWebViewRoutes {
  WebView = 'WebView',
}

export type IModalWebViewParamList = {
  [EModalWebViewRoutes.WebView]: {
    title: string;
    url: string;
    isWebEmbed?: boolean;
    hashRoutePath?: EWebEmbedRoutePath;
    hashRouteQueryParams?: Record<string, string>;
    redirectExternalNavigation?: boolean;
    hideHeaderRight?: boolean;
  };
};

// Root-level WebView overlay (separate from the modal-card webview above).
// Reachable at ERootRoutes.WebView ('RootWebView') from in-app calls,
// deeplinks, and notification taps.
export enum EWebViewRoutes {
  WebView = 'WebView',
}

export interface IWebViewPageParams {
  url: string;
  title?: string;
  hideHeader?: boolean;
  /** Address bar is hidden by default — opt-in by passing `true`. */
  showAddressBar?: boolean;
  /** Set by the entry layer (deeplink/notification handler or in-app caller); never a deeplink query param. */
  source?: 'deeplink' | 'notification' | 'in-app' | 'custom-injected';
  /** Internal-only state created after a confirmed Desktop custom injection
   * workspace is activated. It is never copied directly from DeepLink params.
   */
  customInjected?: {
    sessionId: string;
    protocolId: string;
    preloadUrl: string;
    bundleSha256: string;
    registrySha256: string;
  };
}

export type IWebViewParamList = {
  [EWebViewRoutes.WebView]: IWebViewPageParams;
};
