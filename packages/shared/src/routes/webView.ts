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
    /**
     * Inject the full dApp session features (account/network change events on
     * top of the inpage provider every WebView already carries). Opt-in: the
     * plain modal is used for docs/onramp pages that never connect a wallet.
     */
    enableDappBridge?: boolean;
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
  source?: 'deeplink' | 'notification' | 'in-app';
}

export type IWebViewParamList = {
  [EWebViewRoutes.WebView]: IWebViewPageParams;
};
