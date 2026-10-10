import type { IElement } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IBrowserType } from '../types';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebView } from 'react-native-webview';

export const browserTypeHandler: IBrowserType = (() => {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return 'MultiTabBrowser';
  }
  return 'StandardBrowser';
})();

export const webviewRefs: Record<string, IWebViewWrapperRef> = {};
export const captureViewRefs: Record<string, IElement> = {};

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  globalThis.$$webviewRefs = webviewRefs;
}

export function getWebviewWrapperRef(id?: string) {
  const ref = id ? webviewRefs[id] : null;
  return ref ?? null;
}

export function formatHiddenHttpsUrl(url?: string) {
  return {
    isHttpsUrl: url && /^https/i.test(url),
    hiddenHttpsUrl: url?.replace?.(/^https:\/\//i, ''),
  };
}

export function crossWebviewLoadUrl({
  url,
  tabId,
}: {
  url: string;
  tabId?: string;
}) {
  const wrapperRef = getWebviewWrapperRef(tabId);
  // debugLogger.webview.info('crossWebviewLoadUrl >>>>', url);
  console.log('crossWebviewLoadUrl >>>>', url);
  if (platformEnv.isDesktop) {
    setTimeout(() => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url).catch();
    });
  } else if (platformEnv.isRuntimeBrowser) {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (wrapperRef?.innerRef as WebView)?.loadUrl(url);
  }
}

// for hide keyboard
const injectToDismissWebviewKeyboard = `
(function(){
  document.activeElement && document.activeElement.blur()
})()
`;

export function dismissWebviewKeyboard(id?: string) {
  const ref = getWebviewWrapperRef(id);
  if (ref) {
    if (platformEnv.isNative) {
      try {
        (ref.innerRef as WebView)?.injectJavaScript(
          injectToDismissWebviewKeyboard,
        );
      } catch (error) {
        // ipad mini orientation changed cause injectJavaScript ERROR, which crash app
        console.error(
          'blurActiveElement webview.injectJavaScript() ERROR >>>>> ',
          error,
        );
      }
    }
    if (platformEnv.isDesktop) {
      const deskTopRef = ref.innerRef as IElectronWebView;
      if (deskTopRef) {
        try {
          deskTopRef.executeJavaScript(injectToDismissWebviewKeyboard);
        } catch (_e) {
          // if not dom ready, no need to pause websocket
        }
      }
    }
  }
}

// https://github.com/facebook/hermes/issues/114#issuecomment-887106990
export const injectToPauseWebsocket = `
(function(){
  if (window.WebSocket) {
    if (!window.$$onekeyWebSocketSend) {
      window.$$onekeyWebSocketSend = window.WebSocket.prototype.send;
    }
    window.WebSocket.prototype.send = () => {};
  }
})()
`;

export const injectToResumeWebsocket = `
(function(){
  if (
    window.WebSocket &&
    window.$$onekeyWebSocketSend
  ) {
    window.WebSocket.prototype.send = window.$$onekeyWebSocketSend;
  }
})()
`;

// Off-route variants of the pair above, with their own save slot.
//
// The per-tab policy (setCurrentWebTab -> pauseDappInteraction) already pauses
// the WebSocket of every tab the user switches away from, and resumes only the
// tab being switched to. The off-route pass runs across every live WebView, so
// it must not decide on its own what "resumed" means for a background tab —
// using the shared slot would resume tabs the per-tab policy had deliberately
// paused, and leave them with WebSocket running while their jsBridge stays
// disabled.
//
// Instead the off-route pass saves whatever `send` is at that moment (the real
// one, or the per-tab policy's no-op) and undoes only its own replacement.
//
// Restoring the snapshot unconditionally would be wrong, because the per-tab
// policy runs inside the window: leaving the browser route pauses the active
// tab, and returning to it resumes that tab — and on desktop the tab bar's
// focus listener runs before this one. An unconditional write-back would then
// re-stub the tab the user is looking at, silently killing its outbound
// WebSocket with no visible symptom. Keeping the installed no-op and comparing
// identity makes the pass correct under any interleaving instead of relying on
// listener order.
export const injectToPauseWebsocketOffRoute = `
(function(){
  if (!window.WebSocket || window.$$onekeyOffRouteWebSocketSend) {
    return;
  }
  window.$$onekeyOffRouteWebSocketSend = window.WebSocket.prototype.send;
  window.$$onekeyOffRouteWebSocketNoop = () => {};
  window.WebSocket.prototype.send = window.$$onekeyOffRouteWebSocketNoop;
})()
`;

export const injectToResumeWebsocketOffRoute = `
(function(){
  if (!window.WebSocket || !window.$$onekeyOffRouteWebSocketSend) {
    return;
  }
  if (
    window.WebSocket.prototype.send === window.$$onekeyOffRouteWebSocketNoop
  ) {
    window.WebSocket.prototype.send = window.$$onekeyOffRouteWebSocketSend;
  }
  window.$$onekeyOffRouteWebSocketSend = undefined;
  window.$$onekeyOffRouteWebSocketNoop = undefined;
})()
`;

// Report the page as hidden while the user is away from the browser route.
//
// Suppressing WebSocket.send only stops OUTBOUND traffic; a push-heavy DApp
// (a trading page streaming prices) keeps receiving and processing messages,
// which is where its CPU actually goes. Sites generally do throttle themselves
// when the Page Visibility API says they are hidden, but an Electron <webview>
// that stays mounted off-route never reports hidden on its own. Shadowing the
// prototype getters on the document instance and firing the event lets the
// page's own background handling engage.
//
// Own properties are configurable so resume can `delete` them and let the real
// prototype getters take over again.
export const injectToReportPageHidden = `
(function(){
  try {
    if (!window.$$onekeyPageHiddenPatched) {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: function () { return 'hidden'; },
      });
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: function () { return true; },
      });
      window.$$onekeyPageHiddenPatched = true;
    }
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
  } catch (e) {}
})()
`;

export const injectToReportPageVisible = `
(function(){
  try {
    if (window.$$onekeyPageHiddenPatched) {
      delete document.visibilityState;
      delete document.hidden;
      window.$$onekeyPageHiddenPatched = false;
    }
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  } catch (e) {}
})()
`;
