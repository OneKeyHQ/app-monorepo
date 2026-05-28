import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { View } from 'react-native';
import WebView from 'react-native-webview';

import { Stack } from '@onekeyhq/components';

import { useChartConfig } from './hooks/useChartConfig';
import { generateChartHTML } from './utils/htmlTemplate';

import type {
  IChartMessage,
  ILightweightChartConfig,
  ILightweightChartProps,
} from './types';
import type { WebViewMessageEvent } from 'react-native-webview';

function buildStaticWebViewSource(config: ILightweightChartConfig) {
  return {
    html: generateChartHTML(config),
  };
}

export function LightweightChart({
  data,
  height,
  lineColor,
  topColor,
  bottomColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth,
  showPriceScale,
  showHorzGridLines,
  priceScaleMargins,
  priceFormatter,
  fontSize,
  seriesType,
  baselineOptions,
  showLastValue,
  onHover,
}: ILightweightChartProps) {
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  const chartConfig = useChartConfig({
    data,
    lineColor,
    topColor,
    bottomColor,
    secondaryLineData,
    secondaryLineColor,
    secondaryLineWidth,
    lineWidth,
    showPriceScale,
    showHorzGridLines,
    priceScaleMargins,
    priceFormatter,
    fontSize,
    seriesType,
    baselineOptions,
  });
  const nativeConfig = useMemo(
    () => ({ ...chartConfig, showLastValue: !!showLastValue }),
    [chartConfig, showLastValue],
  );
  const [webViewSource] = useState(() =>
    buildStaticWebViewSource(nativeConfig),
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as IChartMessage;

        if (message.type === 'ready') {
          setWebViewReady(true);
        } else if (message.type === 'hover' && onHover) {
          onHover({
            time: message.time ? Number(message.time) : undefined,
            price: message.price ? Number(message.price) : undefined,
            secondaryPrice: message.secondaryPrice
              ? Number(message.secondaryPrice)
              : undefined,
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

  // Update chart when data changes
  useEffect(() => {
    if (webViewReady && webViewRef.current) {
      const updateScript = `
        (function() {
          const newConfig = ${JSON.stringify(nativeConfig)};
          if (typeof window.applyChartConfig === 'function') {
            window.applyChartConfig(newConfig);
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }
  }, [nativeConfig, webViewReady]);

  return (
    <Stack position="relative" height={height} width="100%">
      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={webViewSource}
          onLoadStart={() => {
            setWebViewReady(false);
          }}
          onMessage={handleMessage}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={{ backgroundColor: 'transparent' }}
          androidLayerType="hardware"
          originWhitelist={['*']}
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
        />
      </View>
    </Stack>
  );
}
