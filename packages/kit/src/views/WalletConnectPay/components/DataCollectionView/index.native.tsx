import { useRef } from 'react';

import { WebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';
import { WALLET_CONNECT_PAY_TRUSTED_HOST } from '@onekeyhq/shared/src/walletConnect/payConstant';

import type { IDataCollectionViewProps } from './types';
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';

function isTrustedPayUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === WALLET_CONNECT_PAY_TRUSTED_HOST ||
      host.endsWith(`.${WALLET_CONNECT_PAY_TRUSTED_HOST}`)
    );
  } catch {
    return false;
  }
}

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
        // keep navigation inside the trusted WalletConnect Pay host
        onShouldStartLoadWithRequest={(request: WebViewNavigation) =>
          isTrustedPayUrl(request.url)
        }
      />
    </Stack>
  );
}
