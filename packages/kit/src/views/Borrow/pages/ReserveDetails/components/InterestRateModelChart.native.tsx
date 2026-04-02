import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';
import { View } from 'react-native';
import WebView from 'react-native-webview';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import { LIGHTWEIGHT_CHARTS_CDN } from '@onekeyhq/kit/src/components/LightweightChart/utils/constants';

import {
  BASE_TIMESTAMP,
  CHART_HEIGHT,
  INTEREST_RATE_CHART_COLORS,
  InterestRateModelHeader,
  InterestRateModelLegend,
  InterestRateModelTooltip,
  UTILIZATION_RANGE,
  calculatePopoverPosition,
  convertUtilizationToTime,
  normalizeApyToPercent,
  normalizeUtilization,
  useInterestRateModelLabels,
} from './InterestRateModelChartShared';

import type {
  IHoverData,
  IInterestRateModelChartProps,
} from './InterestRateModelChartShared';
import type { WebViewMessageEvent } from 'react-native-webview';

interface IChartConfig {
  supplyData: Array<{ time: number; value: number }>;
  borrowData: Array<{ time: number; value: number }>;
  utilizationRatio: number | null;
  theme: {
    bgColor: string;
    textColor: string;
    textSubduedColor: string;
    gridLineColor: string;
    supplyLineColor: string;
    supplyTopColor: string;
    supplyBottomColor: string;
    borrowLineColor: string;
    borrowTopColor: string;
    borrowBottomColor: string;
    verticalLineColor: string;
  };
}

function generateChartHTML(config: IChartConfig): string {
  const configJSON = JSON.stringify(config);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="${LIGHTWEIGHT_CHARTS_CDN}"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #chart { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    (function() {
      const config = ${configJSON};
      const container = document.getElementById('chart');

      // Base timestamp and range for mapping utilization (0-1) to time axis
      const BASE_TIMESTAMP = ${BASE_TIMESTAMP};
      const UTILIZATION_RANGE = ${UTILIZATION_RANGE};
      
      const convertUtilizationToTime = (util) => {
        const clampedUtil = Math.max(0, Math.min(1, util));
        return BASE_TIMESTAMP + Math.round(clampedUtil * UTILIZATION_RANGE);
      };
      
      const convertTimeToUtilization = (time) => {
        const util = (time - BASE_TIMESTAMP) / UTILIZATION_RANGE;
        return Math.max(0, Math.min(1, util));
      };

      const chart = LightweightCharts.createChart(container, {
        layout: {
          background: { color: config.theme.bgColor },
          textColor: config.theme.textSubduedColor,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { 
            visible: true, 
            color: config.theme.gridLineColor,
            style: 2,
          },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: {
            color: config.theme.textSubduedColor,
            width: 1,
            style: 3,
            labelVisible: false,
          },
          horzLine: { visible: false },
        },
        timeScale: {
          borderVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
          tickMarkFormatter: (time) => {
            const util = convertTimeToUtilization(time);
            return Math.round(util * 100) + '%';
          },
        },
        rightPriceScale: {
          visible: true,
          borderVisible: false,
        },
        leftPriceScale: { visible: false },
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: false,
          horzTouchDrag: false,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: false,
          mouseWheel: false,
          pinch: false,
          axisDoubleClickReset: false,
        },
        kineticScroll: {
          touch: false,
          mouse: false,
        },
      });

      // Add supply series
      const supplySeries = chart.addAreaSeries({
        topColor: config.theme.supplyTopColor,
        bottomColor: config.theme.supplyBottomColor,
        lineColor: config.theme.supplyLineColor,
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (price) => price.toFixed(2) + '%',
        },
      });
      supplySeries.setData(config.supplyData);

      // Add borrow series
      const borrowSeries = chart.addAreaSeries({
        topColor: config.theme.borrowTopColor,
        bottomColor: config.theme.borrowBottomColor,
        lineColor: config.theme.borrowLineColor,
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (price) => price.toFixed(2) + '%',
        },
      });
      borrowSeries.setData(config.borrowData);

      // Add vertical line for current utilization
      if (config.utilizationRatio !== null) {
        const currentUtilTime = convertUtilizationToTime(config.utilizationRatio);
        const maxValue = Math.max(
          ...config.supplyData.map(d => d.value),
          ...config.borrowData.map(d => d.value)
        ) || 1;

        const minTime = BASE_TIMESTAMP;
        const maxTime = BASE_TIMESTAMP + UTILIZATION_RANGE;
        const lineTimeDelta = Math.max(Number.EPSILON * currentUtilTime, Number.EPSILON);
        const lineStartTime = Math.max(minTime, currentUtilTime - lineTimeDelta);
        const lineEndTime = Math.min(maxTime, currentUtilTime + lineTimeDelta);

        const verticalLineSeries = chart.addLineSeries({
          color: config.theme.verticalLineColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          lineType: LightweightCharts.LineType.WithSteps,
          lineStyle: 0,
        });

        verticalLineSeries.setData([
          { time: lineStartTime, value: 0 },
          { time: lineEndTime, value: maxValue * 1.1 },
        ]);
      }

      chart.timeScale().fitContent();

      // Store refs for updates
      window.chart = chart;
      window.supplySeries = supplySeries;
      window.borrowSeries = borrowSeries;

      // Subscribe to crosshair move for tooltip
      chart.subscribeCrosshairMove((param) => {
        if (param.time && param.point && param.seriesPrices && param.seriesPrices.size > 0) {
          const supplyPrice = param.seriesPrices.get(supplySeries);
          const borrowPrice = param.seriesPrices.get(borrowSeries);
          
          if (supplyPrice !== undefined && borrowPrice !== undefined) {
            const util = convertTimeToUtilization(param.time);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'hover',
              data: {
                utilizationRatio: util,
                supplyApy: supplyPrice,
                borrowApy: borrowPrice,
                x: param.point.x,
                y: param.point.y,
              }
            }));
            return;
          }
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hoverEnd' }));
      });

      new ResizeObserver(entries => {
        if (entries.length) {
          const { width, height } = entries[0].contentRect;
          chart.applyOptions({ width, height });
        }
      }).observe(container);

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    })();
  </script>
</body>
</html>`;
}

export function InterestRateModelChart({
  borrowCurve,
  supplyCurve,
  utilizationRatio,
  isLoading,
}: IInterestRateModelChartProps) {
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [hoverData, setHoverData] = useState<IHoverData | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const theme = useTheme();

  const {
    utilizationRatioLabel,
    currentUtilizationLabel,
    supplyApyLabel,
    borrowApyLabel,
  } = useInterestRateModelLabels();

  const popoverPosition = useMemo(
    () =>
      hoverData
        ? calculatePopoverPosition(hoverData.x, hoverData.y, containerWidth)
        : null,
    [hoverData, containerWidth],
  );

  const chartConfig = useMemo((): IChartConfig | null => {
    if (!borrowCurve.length || !supplyCurve.length) {
      return null;
    }

    const supplyData = supplyCurve.map(([util, apy]) => ({
      time: convertUtilizationToTime(normalizeUtilization(util)),
      value: normalizeApyToPercent(parseFloat(apy)),
    }));

    const borrowData = borrowCurve.map(([util, apy]) => ({
      time: convertUtilizationToTime(normalizeUtilization(util)),
      value: normalizeApyToPercent(parseFloat(apy)),
    }));

    const parsedUtilRatio = utilizationRatio
      ? normalizeUtilization(parseFloat(utilizationRatio))
      : null;

    return {
      supplyData,
      borrowData,
      utilizationRatio: parsedUtilRatio,
      theme: {
        bgColor: 'transparent',
        textColor: theme.text?.val || '#000000',
        textSubduedColor: theme.textSubdued?.val || '#666666',
        gridLineColor: theme.borderSubdued?.val || '#E5E5EA',
        supplyLineColor: INTEREST_RATE_CHART_COLORS.supply.line,
        supplyTopColor: INTEREST_RATE_CHART_COLORS.supply.top,
        supplyBottomColor: INTEREST_RATE_CHART_COLORS.supply.bottom,
        borrowLineColor: INTEREST_RATE_CHART_COLORS.borrow.line,
        borrowTopColor: INTEREST_RATE_CHART_COLORS.borrow.top,
        borrowBottomColor: INTEREST_RATE_CHART_COLORS.borrow.bottom,
        verticalLineColor: theme.iconSubdued?.val || '#8C8CA1',
      },
    };
  }, [
    borrowCurve,
    supplyCurve,
    utilizationRatio,
    theme.text?.val,
    theme.textSubdued?.val,
    theme.borderSubdued?.val,
    theme.iconSubdued?.val,
  ]);

  const htmlContent = useMemo(
    () => (chartConfig ? generateChartHTML(chartConfig) : ''),
    [chartConfig],
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type: string;
        data?: IHoverData;
      };
      if (message.type === 'ready') {
        setWebViewReady(true);
      } else if (message.type === 'hover' && message.data) {
        setHoverData(message.data);
      } else if (message.type === 'hoverEnd') {
        setHoverData(null);
      }
    } catch (error) {
      console.error(
        'InterestRateModelChart: Error parsing WebView message:',
        error,
      );
    }
  }, []);

  // Update chart when data changes
  useEffect(() => {
    if (webViewReady && webViewRef.current && chartConfig) {
      const updateScript = `
        (function() {
          if (window.supplySeries && window.borrowSeries) {
            const newConfig = ${JSON.stringify(chartConfig)};
            window.supplySeries.setData(newConfig.supplyData);
            window.borrowSeries.setData(newConfig.borrowData);
            window.chart.timeScale().fitContent();
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }
  }, [chartConfig, webViewReady]);

  const utilizationPercentage = utilizationRatio
    ? `${(normalizeUtilization(parseFloat(utilizationRatio)) * 100).toFixed(
        2,
      )}%`
    : '0.00%';

  if (isLoading) {
    return (
      <YStack gap="$6">
        <Skeleton width={180} height={24} borderRadius="$2" />
        <XStack gap="$3" ai="center">
          <Skeleton width={80} height={16} borderRadius="$2" />
          <Skeleton width={80} height={16} borderRadius="$2" />
          <Skeleton width={120} height={16} borderRadius="$2" />
        </XStack>
        <Stack height={CHART_HEIGHT}>
          <Skeleton width="100%" height={CHART_HEIGHT} />
        </Stack>
      </YStack>
    );
  }

  if (!borrowCurve.length || !supplyCurve.length) {
    return null;
  }

  return (
    <YStack gap="$6">
      <InterestRateModelHeader
        utilizationPercentage={utilizationPercentage}
        utilizationRatioLabel={utilizationRatioLabel}
      />

      <InterestRateModelLegend
        borrowApyLabel={borrowApyLabel}
        supplyApyLabel={supplyApyLabel}
        currentUtilizationLabel={currentUtilizationLabel}
      />

      <Stack
        width="100%"
        height={CHART_HEIGHT}
        position="relative"
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width !== containerWidth) {
            setContainerWidth(width);
          }
        }}
      >
        {hoverData && popoverPosition ? (
          <InterestRateModelTooltip
            hoverData={hoverData}
            popoverPosition={popoverPosition}
            utilizationRatioLabel={utilizationRatioLabel}
            borrowApyLabel={borrowApyLabel}
            supplyApyLabel={supplyApyLabel}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
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
    </YStack>
  );
}
