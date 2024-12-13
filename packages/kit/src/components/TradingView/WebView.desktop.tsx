import { useLayoutEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

interface ITradingViewProps {
  uri: string;
  injectedJavaScript: string;
}

interface IWebViewProps {
  tradingViewProps: ITradingViewProps;
  style: ViewStyle;
  onLoadEnd: () => void;
}

export function WebView({
  tradingViewProps: { uri, injectedJavaScript },
  style,
  onLoadEnd,
}: IWebViewProps): JSX.Element | null {
  const ref = useRef<HTMLWebViewElement | null>(null);

  useLayoutEffect(() => {
    const webview = ref.current;
    if (webview) {
      webview.addEventListener('did-attach', () => {
        (
          webview as unknown as {
            executeJavaScript: (code: string, userGesture: boolean) => void;
          }
        ).executeJavaScript(injectedJavaScript, true);
      });
      webview.addEventListener('dom-ready', () => {
        onLoadEnd();
      });
      webview.addEventListener('will-navigate', (event) => {
        event.preventDefault();
      });
    }

    setTimeout(() => {
      onLoadEnd();
    }, 5500);
  }, [injectedJavaScript, onLoadEnd, uri]);

  return uri ? (
    <Stack style={style}>
      <webview style={{ flex: 1 }} ref={ref} src={uri} />
    </Stack>
  ) : null;
}
