import { useRef } from 'react';

import { WebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';
import { isWcPayTrustedUrl } from '@onekeyhq/shared/src/walletConnect/payConstant';

import type { IDataCollectionViewProps } from './types';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

/**
 * Native variant: the hosted compliance form runs in a WebView and reports
 * completion through the ReactNativeWebView message bridge.
 */
export function DataCollectionView({
  url,
  onComplete,
  onError,
}: IDataCollectionViewProps) {
  const completedRef = useRef(false);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        error?: string;
      };
      if (data?.type === 'IC_COMPLETE' && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      } else if (data?.type === 'IC_ERROR' && !completedRef.current) {
        completedRef.current = true;
        onError(String(data?.error ?? 'Data collection failed'));
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <Stack flex={1}>
      <WebView
        source={{ uri: url }}
        onMessage={handleMessage}
        javaScriptEnabled
        // the hosted form requires DOM storage; Android defaults it to off
        domStorageEnabled
        // keep top-frame navigation inside the trusted WalletConnect Pay
        // host; iOS also reports loads of embedded frames here, which the
        // page's own CSP (frame-src) governs, so let those through
        onShouldStartLoadWithRequest={(request: ShouldStartLoadRequest) =>
          !request.isTopFrame || isWcPayTrustedUrl(request.url)
        }
      />
    </Stack>
  );
}
