import { WebView as NativeWebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

export function WebView({ uri, style }: { uri: string; style: ViewStyle }) {
  return (
    <Stack style={style as any}>
      <NativeWebView
        source={{
          uri,
        }}
      />
    </Stack>
  );
}
