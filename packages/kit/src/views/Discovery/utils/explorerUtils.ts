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
  global.$$webviewRefs = webviewRefs;
}

export const isValidWebUrl = (url: string) =>
  /^[^/\s]+\.(?:ai|app|art|co|com|club|dev|ee|fi|finance|game|im|info|io|is|it|net|network|news|org|so|xyz)(?:\/[^/\s]*)*$/.test(
    url,
  );

export const validateUrl = (url: string): string => {
  let validatedUrl;
  try {
    validatedUrl = new URL(url);
  } catch (e) {
    if (isValidWebUrl(url)) {
      return `https://${url}`;
    }
    return `https://www.google.com/search?q=${url}`;
  }

  return validatedUrl?.href ?? url;
};

export function getWebviewWrapperRef(id?: string) {
  const ref = id ? webviewRefs[id] : null;
  return ref ?? null;
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
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url).catch();
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
        } catch (e) {
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
