import { useCallback, useMemo } from 'react';

import { WebView as NativeWebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

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
  return uri ? (
    <Stack style={style as any}>
      <NativeWebView
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {}}
        webviewDebuggingEnabled
        injectedJavaScript={injectedJavaScript}
        source={{
          uri,
        }}
        onLoadEnd={handleLoadedEnd}
        {...props}
      />
    </Stack>
  ) : null;
}
