import { useRef, useState } from 'react';

import { WebView } from 'react-native-webview';

import { Spinner, Stack } from '@onekeyhq/components';
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
  // the hosted form can take seconds to load; keep a spinner over the empty
  // webview so the page never looks blank/frozen
  const [isFormLoaded, setIsFormLoaded] = useState(false);

  const handleMessage = (event: WebViewMessageEvent) => {
    // mirror the web variant's origin check: the RN webview bridge is visible
    // to every frame in the page, so ignore messages not sent from a trusted
    // WalletConnect Pay URL (e.g. embedded third-party iframes)
    if (!isWcPayTrustedUrl(event.nativeEvent.url ?? '')) {
      return;
    }
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
        onLoadEnd={() => setIsFormLoaded(true)}
      />
      {!isFormLoaded ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          alignItems="center"
          justifyContent="center"
          bg="$bgApp"
          pointerEvents="none"
        >
          <Spinner size="large" />
        </Stack>
      ) : null}
    </Stack>
  );
}
