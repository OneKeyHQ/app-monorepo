import { useCallback } from 'react';

import { WebView as NativeWebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

export function WebView({
  uri,
  style,
  onLoadEnd,
  ...props
}: {
  uri: string;
  style: ViewStyle;
  onLoadEnd: () => void;
}) {
  const handleLoadedEnd = useCallback(() => {
    setTimeout(() => {
      onLoadEnd();
    }, 800);
  }, [onLoadEnd]);
  return (
    <Stack style={style as any}>
      <NativeWebView
        source={{
          uri,
        }}
        onLoadEnd={handleLoadedEnd}
        {...props}
      />
    </Stack>
  );
}
