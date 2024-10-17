import { WebView as NativeWebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

export function WebView({
  htmlCode,
  style,
}: {
  htmlCode: string;
  style: ViewStyle;
}) {
  return (
    <Stack style={style as any}>
      <NativeWebView
        source={{
          html: htmlCode,
        }}
      />
    </Stack>
  );
}
