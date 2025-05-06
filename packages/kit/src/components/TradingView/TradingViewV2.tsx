import { useEffect, useRef } from 'react';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../WebView';

import type { IWebViewRef } from '../WebView/types';
import type { WebViewProps } from 'react-native-webview';

interface IBaseTradingViewProps {
  mode: 'overview' | 'realtime';
  identifier: string;
  baseToken: string;
  targetToken: string;
  onLoadEnd: () => void;
  tradingViewUrl?: string;
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

export function TradingViewV2(props: ITradingViewProps & WebViewProps) {
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;
  const webRef = useRef<IWebViewRef | null>(null);
  const { onLoadEnd, tradingViewUrl = 'https://tradingview.onekeytest.com/' } =
    props;

  useEffect(() => {
    const interval = setInterval(() => {
      if (webRef.current) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'tradingview',
          payload: {
            test: 'test',
          },
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <Stack position="relative" flex={1}>
      <WebView
        onLoadEnd={onLoadEnd}
        onWebViewRef={(ref) => {
          webRef.current = ref;
        }}
        displayProgressBar={false}
        src={tradingViewUrl}
      />

      {platformEnv.isNativeIOS || isIPadPortrait ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={isIPadPortrait ? 50 : 40}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
}
