import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IElectronWebView, IWebViewRef } from '../../WebView/types';
import type { WebView } from 'react-native-webview';

export function syncTradingViewTheme(
  webViewRef: IWebViewRef | null,
  theme: 'light' | 'dark',
) {
  if (!webViewRef?.innerRef) {
    return;
  }

  const script = `
    (function() {
      window.__onekeyTradingViewTheme = ${JSON.stringify(theme)};
      var retryCount = 0;
      function scheduleRetry() {
        retryCount += 1;
        if (retryCount < 20) {
          setTimeout(applyTheme, 100);
        }
      }
      function applyTheme() {
        try {
          var frame = document.querySelector('iframe[id^="tradingview_"]');
          var frameWindow = frame && frame.contentWindow;
          var changeTheme = frameWindow && frameWindow.changeTheme;
          if (typeof changeTheme === 'function') {
            var applyCurrentTheme = function() {
              Promise.resolve(
                changeTheme.call(frameWindow, window.__onekeyTradingViewTheme)
              ).catch(scheduleRetry);
            };
            var doWhenApiIsReady = frameWindow.doWhenApiIsReady;
            if (typeof doWhenApiIsReady === 'function') {
              // changeTheme is exposed before the TradingView API is ready.
              doWhenApiIsReady.call(frameWindow, applyCurrentTheme);
            } else {
              applyCurrentTheme();
            }
            return;
          }
        } catch (error) {
          // Retry while the chart frame is still initializing.
        }
        scheduleRetry();
      }
      applyTheme();
    })();
    true;
  `;

  try {
    if (platformEnv.isNative) {
      (webViewRef.innerRef as WebView).injectJavaScript(script);
    } else if (platformEnv.isDesktop) {
      void Promise.resolve(
        (webViewRef.innerRef as IElectronWebView).executeJavaScript(script),
      ).catch(() => {});
    }
  } catch {
    // The load-complete callback retries after the WebView becomes ready.
  }
}
