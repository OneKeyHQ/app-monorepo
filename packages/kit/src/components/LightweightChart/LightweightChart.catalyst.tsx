import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import WebView from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import { useChartConfig } from './hooks/useChartConfig';
import { generateChartHTML } from './utils/htmlTemplate';

import type { IChartMessage, ILightweightChartProps } from './types';
import type { WebViewMessageEvent } from 'react-native-webview';

export function LightweightChart(props: ILightweightChartProps) {
  const {
    height,
    hideCrosshairPriceLabel,
    nativeScrubOptions,
    onHover,
    pulseLastPoint,
  } = props;
  const chartConfig = useChartConfig(props);
  const config = useMemo(
    () => ({
      ...chartConfig,
      hideCrosshairPriceLabel,
      nativeScrubOptions,
      notifyOnHover: Boolean(onHover),
      pulseLastPoint,
    }),
    [
      chartConfig,
      hideCrosshairPriceLabel,
      nativeScrubOptions,
      onHover,
      pulseLastPoint,
    ],
  );
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // Keep the document stable while applying data and theme changes in place.
  const [source] = useState(() => ({ html: generateChartHTML(config) }));
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as IChartMessage;
        if (message.type === 'ready') {
          setReady(true);
        } else if (message.type === 'hover') {
          onHover?.({
            time: message.time === undefined ? undefined : Number(message.time),
            price:
              message.price === undefined ? undefined : Number(message.price),
            secondaryPrice:
              message.secondaryPrice === undefined
                ? undefined
                : Number(message.secondaryPrice),
            x: message.x,
            y: message.y,
          });
        }
      } catch (error) {
        console.error(
          'LightweightChart: Error parsing WebView message:',
          error,
        );
      }
    },
    [onHover],
  );
  useEffect(() => {
    if (ready) {
      webViewRef.current?.injectJavaScript(`
        if (typeof window.applyChartConfig === 'function') {
          window.applyChartConfig(${JSON.stringify(config)});
        }
        true;
      `);
    }
  }, [config, ready]);

  return (
    <Stack height={height} width="100%">
      <WebView
        ref={webViewRef}
        testID="lightweight-chart-catalyst"
        source={source}
        onLoadStart={() => setReady(false)}
        onMessage={handleMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
      />
    </Stack>
  );
}
