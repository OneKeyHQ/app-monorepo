import { useCallback, useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { WebView as NativeWebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';
import { ShouldStartLoadRequestEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent';

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

  const onMessage = useCallback(() => {
  }, []);
  const onShouldStartLoadWithRequest = useCallback((event: ShouldStartLoadRequestEvent) => {
    return !!event.mainDocumentURL?.startsWith('https://www.tradingview-widget.com/embed-widget/advanced-chart');
  }, [])
  return uri ? (
    <Stack style={style as any}>
      <NativeWebView
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        webviewDebuggingEnabled={platformEnv.isDev}
        injectedJavaScript={injectedJavaScript}
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
