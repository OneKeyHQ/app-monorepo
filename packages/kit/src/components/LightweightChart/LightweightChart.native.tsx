import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AppState, UIManager, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import WebView from 'react-native-webview';
import { useDebouncedCallback } from 'use-debounce';

import { Stack } from '@onekeyhq/components';
import { CollapsibleTabContext } from '@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useChartConfig } from './hooks/useChartConfig';
import formatChartPriceSource from './utils/formatChartPriceSource';
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

// The price formatter is baked into the WebView document. Data updates only
// inject JSON, so a formatter change has to remount the page.
function chartFormatterKey(source: string) {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (Math.imul(31, hash) + source.charCodeAt(index)) | 0;
  }
  return String(hash);
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
  pulseLastPointColor,
  priceScaleMinimumWidth,
  priceFormatter,
  priceFormatBase,
  compactPriceMaxCharacters,
  priceScaleFormat,
  priceFormatterPrecision,
  priceFormatterTickStep,
  fontSize,
  seriesType,
  lineType,
  baselineOptions,
  histogramOptions,
  referenceLine,
  showLastValue,
  showLastValuePriceLine,
  lastValueLabelColor,
  showLastPointMarker,
  showTimeScale,
  useTimeScaleTickMarkWithoutUnit,
  timeScaleRightOffsetPixels,
  timeZone,
  locale,
  hideCrosshairPriceLabel,
  pulseLastPoint,
  nativeScrubOptions,
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
    pulseLastPointColor,
    priceScaleMinimumWidth,
    priceFormatter,
    priceFormatBase,
    compactPriceMaxCharacters,
    priceScaleFormat,
    priceFormatterPrecision,
    priceFormatterTickStep,
    fontSize,
    seriesType,
    lineType,
    baselineOptions,
    histogramOptions,
    referenceLine,
    showLastValue,
    showLastValuePriceLine,
    lastValueLabelColor,
    showLastPointMarker,
    showTimeScale,
    useTimeScaleTickMarkWithoutUnit,
    timeScaleRightOffsetPixels,
    timeZone,
    locale,
  });
  const nativeConfig = useMemo(
    () => ({
      ...chartConfig,
      showLastValue: !!showLastValue,
      hideCrosshairPriceLabel,
      pulseLastPoint: !!pulseLastPoint,
      nativeScrubOptions,
      notifyOnHover: !!onHover,
    }),
    [
      chartConfig,
      hideCrosshairPriceLabel,
      pulseLastPoint,
      showLastValue,
      nativeScrubOptions,
      onHover,
    ],
  );
  const latestConfigRef = useRef(nativeConfig);
  latestConfigRef.current = nativeConfig;
  // Bumped on every recovery: it keys the WebView, so recovery is a remount.
  // Android does not let a WebView whose renderer is gone be reused, so a new
  // source on the old instance can stay blank; a fresh instance is the only
  // reliable path there, and it serves iOS just as well.
  const [webViewGeneration, setWebViewGeneration] = useState(0);
  const formatterKey = chartFormatterKey(formatChartPriceSource);
  // Rebuild the document when the embedded formatter changes. Data updates
  // still go through injectJavaScript and must not reload the page.
  const webViewSource = useMemo(() => {
    const source = buildStaticWebViewSource(latestConfigRef.current);
    return {
      html: source.html.replace(
        '<head>',
        `<head><meta name="chart-price-formatter" content="${formatterKey}-${webViewGeneration}" />`,
      ),
    };
  }, [formatterKey, webViewGeneration]);

  // The OS can kill the WebView's content process while the page sits idle
  // (memory pressure on the phone), and react-native-webview does nothing
  // about it: the chart area just goes blank until something injects script
  // again, which is why switching the date range "repaired" it (OK-62409).
  // Rebuild the source from the latest config so the reload paints the
  // current data straight away; the ready handshake then resumes updates.
  const handleContentProcessGone = useCallback(() => {
    setWebViewReady(false);
    setWebViewGeneration((generation) => generation + 1);
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

  const repaintChart = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        if (typeof window.repaintChart === 'function') {
          window.repaintChart();
        }
      })();
      true;
    `);
  }, []);

  // Collapsing the header moves the WebView offscreen without a DOM resize.
  // Repaint the existing canvas when it returns, without resetting the range.
  const tabsContext = useContext(CollapsibleTabContext);
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const headerHeight = tabsContext?.headerHeight ?? 0;
  useAnimatedReaction(
    () => !scrollYCurrent || scrollYCurrent.value < headerHeight,
    (isVisible, wasVisible) => {
      if (isVisible && wasVisible === false) {
        runOnJS(repaintChart)();
      }
    },
    [scrollYCurrent, headerHeight, repaintChart],
  );

  const headerTranslateY = tabsContext?.headerTranslateY;
  const needsLegacyRemountRef = useRef(false);
  const supportsNativeLayout = useMemo(() => {
    if (!platformEnv.isNativeIOS) return false;
    // OTA JS may expose the ref method even when the native shell lacks it.
    const viewConfig = UIManager.getViewManagerConfig('RNCWebView') as {
      Commands?: { requestLayout?: number };
    } | null;
    return viewConfig?.Commands?.requestLayout !== undefined;
  }, []);
  const syncNativeLayout = useDebouncedCallback(() => {
    if (supportsNativeLayout) {
      webViewRef.current?.requestLayout?.();
    } else if (needsLegacyRemountRef.current) {
      // Older shells need one visible remount if initialization happened offscreen.
      needsLegacyRemountRef.current = false;
      handleContentProcessGone();
    }
  }, 100);
  const cancelNativeLayout = useCallback(() => {
    syncNativeLayout.cancel();
  }, [syncNativeLayout]);
  const handleHeaderHidden = useCallback(() => {
    cancelNativeLayout();
    if (!supportsNativeLayout && !webViewReady) {
      needsLegacyRemountRef.current = true;
    }
  }, [cancelNativeLayout, supportsNativeLayout, webViewReady]);
  const syncVisibleHeader = !!platformEnv.isNativeIOS;

  // WKWebView does not receive geometry notifications when its ancestor moves.
  // Coalesce native layout updates until the visible header stops translating.
  useAnimatedReaction(
    () =>
      syncVisibleHeader && headerTranslateY
        ? Math.max(0, Math.min(headerHeight, -headerTranslateY.value))
        : null,
    (offset, previousOffset) => {
      if (offset === null || offset === previousOffset) return;
      if (offset < headerHeight) {
        runOnJS(syncNativeLayout)();
      } else {
        runOnJS(handleHeaderHidden)();
      }
    },
    [
      handleHeaderHidden,
      headerHeight,
      headerTranslateY,
      syncNativeLayout,
      syncVisibleHeader,
    ],
  );

  useEffect(() => cancelNativeLayout, [cancelNativeLayout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        repaintChart();
      }
    });
    return () => subscription.remove();
  }, [repaintChart]);

  // Update chart when data changes
  useEffect(() => {
    if (webViewReady && webViewRef.current) {
      const updateScript = `
        (function() {
          window.__onekeyFormatChartPrice = ${formatChartPriceSource};
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
          key={`${webViewGeneration}-${formatterKey}`}
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
