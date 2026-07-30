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
