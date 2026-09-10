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

function buildStaticWebViewSource(
  config: ILightweightChartConfig,
  reloadCount = 0,
) {
  return {
    // react-native-webview skips the load when the new source dictionary
    // equals the current one, and a rebuild from an unchanged config produces
    // byte-identical HTML. The marker makes every recovery a distinct source.
    html: `${generateChartHTML(config)}${
      reloadCount ? `<!-- reload ${reloadCount} -->` : ''
    }`,
  };
}

export function LightweightChart({
  data,
  height,
  lineColor,
  topColor,
  bottomColor,
  textSubduedColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth,
  showPriceScale,
  showHorzGridLines,
  horzLineColor,
  horzLineStyle,
  priceScalePosition,
  priceScaleMargins,
  priceScaleEntireTextOnly,
  crosshairVertLineColor,
  crosshairVertLineStyle,
  patternColor,
  priceFormatter,
  priceFormatterPrecision,
  priceFormatterTickStep,
  fontSize,
  seriesType,
  lineType,
  baselineOptions,
  histogramOptions,
  referenceLine,
  showLastValue,
  showLastPointMarker,
  showTimeScale,
  useTimeScaleTickMarkWithoutUnit,
  timeZone,
  locale,
  hideCrosshairPriceLabel,
  onHover,
}: ILightweightChartProps) {
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  const chartConfig = useChartConfig({
    data,
    lineColor,
    topColor,
    bottomColor,
    textSubduedColor,
    secondaryLineData,
    secondaryLineColor,
    secondaryLineWidth,
    lineWidth,
    showPriceScale,
    showHorzGridLines,
    horzLineColor,
    horzLineStyle,
    priceScalePosition,
    priceScaleMargins,
    priceScaleEntireTextOnly,
    crosshairVertLineColor,
    crosshairVertLineStyle,
    patternColor,
    priceFormatter,
    priceFormatterPrecision,
    priceFormatterTickStep,
    fontSize,
    seriesType,
    lineType,
    baselineOptions,
    histogramOptions,
    referenceLine,
    showLastValue,
    showLastPointMarker,
    showTimeScale,
    useTimeScaleTickMarkWithoutUnit,
    timeZone,
    locale,
  });
  const nativeConfig = useMemo(
    () => ({
      ...chartConfig,
      showLastValue: !!showLastValue,
      hideCrosshairPriceLabel,
    }),
    [chartConfig, hideCrosshairPriceLabel, showLastValue],
  );
  const [webViewSource, setWebViewSource] = useState(() =>
    buildStaticWebViewSource(nativeConfig),
  );
  const latestConfigRef = useRef(nativeConfig);
  latestConfigRef.current = nativeConfig;
  const reloadCountRef = useRef(0);

  // The OS can kill the WebView's content process while the page sits idle
  // (memory pressure on the phone), and react-native-webview does nothing
  // about it: the chart area just goes blank until something injects script
  // again, which is why switching the date range "repaired" it (OK-62409).
  // Rebuild the source from the latest config so the reload paints the
  // current data straight away; the ready handshake then resumes updates.
  const handleContentProcessGone = useCallback(() => {
    reloadCountRef.current += 1;
    setWebViewReady(false);
    setWebViewSource(
      buildStaticWebViewSource(latestConfigRef.current, reloadCountRef.current),
    );
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as IChartMessage;

        if (message.type === 'ready') {
          setWebViewReady(true);
        } else if (message.type === 'hover' && onHover) {
          onHover({
            time: message.time !== undefined ? Number(message.time) : undefined,
            price:
              message.price !== undefined ? Number(message.price) : undefined,
            secondaryPrice:
              message.secondaryPrice !== undefined
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
          onContentProcessDidTerminate={handleContentProcessGone}
          onRenderProcessGone={handleContentProcessGone}
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
