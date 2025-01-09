import { useCallback, useMemo } from 'react';

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
  const handleLoadedEnd = useCallback(() => {
    setTimeout(() => {
      onLoadEnd();
    }, 500);
  }, [onLoadEnd]);

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
