import { useCallback, useRef } from 'react';

import { Platform } from 'react-native';
import { WebView as NativeWebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ViewStyle } from 'react-native';
import type { ShouldStartLoadRequestEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent';

export function WebView({
  tradingViewProps: { uri, injectedJavaScript },
  style,
  onLoadEnd,
  ...props
}: {
  tradingViewProps: {
    uri: string;
    injectedJavaScript: string;
  };
  style: ViewStyle;
  onLoadEnd: () => void;
}) {
  const webViewRef = useRef<NativeWebView>(null);

  const handleLoadedEnd = useCallback(() => {
    const isIOS16 =
      platformEnv.isNativeIOS &&
      typeof Platform.Version === 'number' &&
      Platform.Version < 17;

    if (isIOS16) {
      const dynamicScript = `
        (function() {
          try {
            if (window.location.href !== '${uri}') {
              window.location.href = '${uri}';
            }

            return true;
          } catch (error) {
            console.error('OneKey injection error:', error);
          }
        })();
      `;

      setTimeout(() => {
        webViewRef.current?.injectJavaScript(dynamicScript);
        webViewRef.current?.injectJavaScript(injectedJavaScript);
      }, 500);
    } else {
      setTimeout(() => {
        onLoadEnd();
      }, 500);
    }
  }, [injectedJavaScript, onLoadEnd, uri]);

  // onMessage handler is required for injectedJavaScript to execute properly
  // Without onMessage, the injected JavaScript code will not run
  const onMessage = useCallback(() => {}, []);
  const onShouldStartLoadWithRequest = useCallback(
    (event: ShouldStartLoadRequestEvent) =>
      !!event.mainDocumentURL?.startsWith(
        'https://www.tradingview-widget.com/embed-widget/advanced-chart',
      ),
    [],
  );
  return uri ? (
    <Stack style={style as any}>
      <NativeWebView
        ref={webViewRef}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        onMessage={onMessage}
        webviewDebuggingEnabled={platformEnv.isDev}
        injectedJavaScript={injectedJavaScript}
        // https://github.com/react-native-webview/react-native-webview/issues/2705
        setSupportMultipleWindows={
          platformEnv.isNativeAndroid ? false : undefined
        }
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        source={{
          uri,
        }}
        onLoadEnd={handleLoadedEnd}
        {...props}
      />
    </Stack>
  ) : null;
}
