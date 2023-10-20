import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebView } from 'react-native-webview';

export const webviewRefs: Record<string, IWebViewWrapperRef> = {};

export type WebHandler = 'browser' | 'tabbedWebview';
export const webHandler: WebHandler = (() => {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return 'tabbedWebview';
  }
  return 'browser';
})();

export function getWebviewWrapperRef(id?: string) {
  let tabId = id;
  if (!tabId) {
    const { getCurrentTabId } =
      require('./Context/contextWebTabs') as typeof import('./Context/contextWebTabs');
    tabId = getCurrentTabId();
  }
  const ref = tabId ? webviewRefs[tabId] : null;
  return ref ?? null;
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
