import { useEffect, useMemo } from 'react';

import { Stack, useMedia } from '@onekeyhq/components';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { ViewStyle } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

const MDHiddenBorder = () => (
  <>
    <Stack h={1} w="100%" bg="$bgApp" top={-14} left={0} position="absolute" />
    <Stack h={1} w="100%" bg="$bgApp" top={28} left={0} position="absolute" />
    <Stack
      h={1}
      w="100%"
      bg="$bgApp"
      bottom={14}
      left={0}
      position="absolute"
    />
    <Stack h="100%" w={1} bg="$bgApp" top={-14} left={0} position="absolute" />
    <Stack h="100%" w={1} bg="$bgApp" top={-14} right={0} position="absolute" />
  </>
);

const HiddenBorder = () => null;

export function WebView({
  tradingViewProps,
  style,
  onLoadEnd,
}: {
  tradingViewProps: {
    uri: string;
  };
  style: ViewStyle;
} & WebViewProps & {
    onLoadEnd: () => void;
  }) {
  const iframeId = useMemo(() => generateUUID(), []);
  useEffect(() => {
    const frame = document.getElementById(iframeId) as HTMLIFrameElement;
    if (frame && tradingViewProps.uri) {
      frame.onload = () => {
        setTimeout(() => {
          onLoadEnd();
        }, 800);
      };
    }
    // Fallback to dismiss loading screen
    setTimeout(() => {
      onLoadEnd();
    }, 3500);
  }, [iframeId, onLoadEnd, tradingViewProps.uri]);
  const { gtMd } = useMedia();
  return (
    <div style={{ ...(style as any), position: 'relative' }}>
      <iframe
        id={iframeId}
        src={tradingViewProps.uri}
        style={{
          height: '100%',
          width: '100%',
          border: 0,
          ...(gtMd
            ? undefined
            : {
                position: 'relative',
                top: -14,
              }),
        }}
        frameBorder="0"
        title="TradingView"
        sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin allow-popups"
      />
      {gtMd ? <HiddenBorder /> : <MDHiddenBorder />}
    </div>
  );
}
