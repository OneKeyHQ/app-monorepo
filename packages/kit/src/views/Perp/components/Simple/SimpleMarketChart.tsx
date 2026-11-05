import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import type { IStockPriceLineChartHoverPoint } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { TradingViewChartLoadingMask } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartLoadingMask';
import { TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartConstants';
import { tradingViewNativeHyperliquidGateway } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/providers/hyperliquid/tradingViewNativeHyperliquidGateway';
import {
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter';
import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import {
  TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT,
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { TOKEN_SIMPLE_CHART_RANGES } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart';
import { mergeStockSimpleChartLivePrice } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/stockSimpleChartData';
import {
  ChartModeButton,
  MobileSimpleChartFrame,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/MobileSimpleChart';
import type { IMobileSimpleChartRange } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/MobileSimpleChart';
import {
  usePerpsCustomSettingsAtom,
  usePerpsTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getSimpleChartPerformance,
  getSimpleChartPoints,
  getSimpleChartRequest,
} from '../../utils/simpleChart';
import { PerpsNativeChart } from '../PerpsNativeChart';

import {
  SIMPLE_CHART_ACTION_STYLE,
  SIMPLE_CHART_CONTROLS,
  SIMPLE_CHART_SEGMENT_STYLE,
} from './SimpleChartControls';

import type { ISimpleChartPerformance } from '../../utils/simpleChart';

const BASE_CHART_HEIGHT = 392;

export type ISimpleMarketChartPrice = ISimpleChartPerformance & {
  price?: number;
  isLoading?: boolean;
  isScrubbing?: boolean;
};

function SimpleMarketLineChart({
  backgroundColor,
  coin,
  height,
  range,
  active,
  livePrice,
  onPriceChange,
}: {
  backgroundColor?: string;
  coin: string;
  height: number;
  range: IMobileSimpleChartRange;
  active: boolean;
  livePrice?: string;
  onPriceChange?: (price: ISimpleMarketChartPrice | undefined) => void;
}) {
  const intl = useIntl();
  const [hoverPoint, setHoverPoint] =
    useState<IStockPriceLineChartHoverPoint>();
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!active) return undefined;
      const request = getSimpleChartRequest(
        range,
        Math.floor(Date.now() / 1000),
      );
      try {
        const { points } =
          await tradingViewNativeHyperliquidGateway.fetchCandles({
            coin,
            environment: 'mainnet',
            interval: request.interval,
            timeFrom: request.timeFrom,
            timeTo: request.timeTo,
          });
        return {
          coin,
          range,
          data: getSimpleChartPoints({ points, ...request }),
          intervalSeconds: request.intervalSeconds,
          error: false,
        };
      } catch {
        return { coin, range, error: true };
      }
    },
    [active, coin, range],
    {
      watchLoading: true,
      pollingInterval: 30_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  const current =
    result?.coin === coin && result.range === range ? result : undefined;
  const data = useMemo(
    () =>
      mergeStockSimpleChartLivePrice({
        points: current?.data ?? [],
        intervalSeconds: current?.intervalSeconds,
        livePrice,
        nowSeconds: Math.floor(Date.now() / 1000),
      }),
    [current, livePrice],
  );
  const hasHistory = !!current && !current.error && data.length > 0;
  const isScrubbing = !!hoverPoint;
  const price = hasHistory
    ? (hoverPoint?.price ?? data[data.length - 1][1])
    : undefined;
  const performance = useMemo(
    () =>
      price === undefined ? undefined : getSimpleChartPerformance(data, price),
    [data, price],
  );
  const change = performance?.change;
  const changePercent = performance?.changePercent;
  const priceLoading = !current || (!hasHistory && !!isLoading);
  // Report display values rather than history object identity to avoid
  // feeding unchanged chart results back into the parent page's state.
  const displayPrice = useMemo<ISimpleMarketChartPrice | undefined>(() => {
    if (!active) return undefined;
    if (priceLoading) return { coin, range, isLoading: true };
    if (price === undefined) return { coin, range };
    return {
      coin,
      range,
      price,
      change,
      changePercent,
      ...(isScrubbing ? { isScrubbing: true } : {}),
    };
  }, [
    active,
    coin,
    range,
    priceLoading,
    price,
    change,
    changePercent,
    isScrubbing,
  ]);
  // A parent render must not clear and re-report the held price just because
  // its callback changed. Only release it when this chart actually unmounts.
  const onPriceChangeRef = useRef(onPriceChange);
  onPriceChangeRef.current = onPriceChange;
  useEffect(() => {
    onPriceChangeRef.current?.(displayPrice);
  }, [displayPrice]);
  useEffect(() => () => onPriceChangeRef.current?.(undefined), []);

  if (!active) return null;
  if (!current) {
    return (
      <TradingViewChartLoadingMask
        backgroundColor={backgroundColor}
        testID="perps-simple-chart-loading"
      />
    );
  }
  if (current.error || !data.length) {
    return (
      <YStack
        testID={
          current.error
            ? 'perps-simple-chart-error'
            : 'perps-simple-chart-empty'
        }
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        <Icon name="ChartLine2Outline" size="$6" color="$iconSubdued" />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: current.error
              ? ETranslations.global_unknown_error_retry_message
              : ETranslations.dexmarket_k_line_no_recent_transactions,
          })}
        </SizableText>
        {current.error ? (
          <Button
            testID="perps-simple-chart-retry"
            size="small"
            variant="tertiary"
            onPress={() => void run()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        ) : null}
      </YStack>
    );
  }
  return (
    <StockPriceLineChart
      key={`${coin}:${range}`}
      testID="perps-simple-price-line-chart"
      data={data}
      height={height}
      lineColorToken="bgAccent"
      pulseLastPoint
      showPriceScale={false}
      showHoverLabel={false}
      clearHoverOnTouchEnd
      onHoverChange={setHoverPoint}
    />
  );
}

export function SimpleMarketChart({
  coin,
  active,
  livePrice,
  onPriceChange,
}: {
  coin: string;
  active: boolean;
  livePrice?: string;
  onPriceChange?: (price: ISimpleMarketChartPrice | undefined) => void;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const [range, setRange] = useState<IMobileSimpleChartRange>('1D');
  const [{ simpleMarketChartMode }, setSettings] = usePerpsCustomSettingsAtom();
  const showCandles = simpleMarketChartMode === 'candles';
  const [fullscreen, setFullscreen] = useState(false);
  const chartBackground =
    !fullscreen && themeVariant === 'light' ? theme.bgSubdued.val : undefined;
  const [indicatorSettings] = usePerpsTradingViewIndicatorSettingsPersistAtom();
  const subIndicatorCount = useMemo(
    () =>
      getTradingViewNativeSubIndicatorInstances(
        normalizeTradingViewNativeIndicatorSettings(indicatorSettings),
      ).length,
    [indicatorSettings],
  );
  const chartHeight =
    BASE_CHART_HEIGHT +
    subIndicatorCount * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT;
  const source = useMemo<ITradingViewNativeSource>(
    () => ({ kind: 'hyperliquid', coin, environment: 'mainnet' }),
    [coin],
  );
  const modeControl = (
    <ChartModeButton
      testID="perps-simple-chart-mode-toggle"
      buttonStyle={fullscreen ? undefined : SIMPLE_CHART_ACTION_STYLE}
      iconSize={fullscreen ? '$4.5' : '$3.5'}
      icon={
        showCandles ? 'TradingViewLineOutline' : 'TradingViewCandlesOutline'
      }
      label={intl.formatMessage({
        id: showCandles
          ? ETranslations.market_chart_mode_simple
          : ETranslations.dexmarket_pro,
      })}
      onPress={() => {
        setFullscreen(false);
        void setSettings((previous) => ({
          ...previous,
          simpleMarketChartMode:
            previous.simpleMarketChartMode === 'candles' ? 'line' : 'candles',
        }));
      }}
    />
  );

  return (
    <Stack
      height={
        showCandles
          ? chartHeight + TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT
          : chartHeight
      }
      mx="$-5"
      my="$-4"
    >
      {showCandles ? (
        <PerpsNativeChart
          active={active}
          testID="perps-simple-native-chart"
          defaultBackgroundColor={chartBackground}
          source={source}
          storageNamespace="perps"
          initialZoomScale={0.45}
          defaultPriceRangeScale={1.25}
          nativeChartDisplayMode={fullscreen ? 'default' : 'marketDetail'}
          nativeControlsLayoutMode="mobile"
          mobileControlsPaddingHorizontal={fullscreen ? undefined : 20}
          mobileToolbarExtra={
            fullscreen ? (
              modeControl
            ) : (
              <XStack ml="$1.5" minHeight={32} alignItems="center">
                {modeControl}
              </XStack>
            )
          }
          mobileControlsAppearance={
            fullscreen ? undefined : SIMPLE_CHART_CONTROLS
          }
          enableNativeChartSettings
          nativeChartSettingsInToolbar
          showNativeIndicatorQuickBar={!fullscreen || platformEnv.isNative}
          maxSelectableSubIndicatorCount={4}
          enableDrawings={!platformEnv.isNative}
          prioritizePageScroll
          isNativeChartFullscreen={fullscreen}
          onNativeChartFullscreenChange={setFullscreen}
        />
      ) : null}
      {!showCandles ? (
        <MobileSimpleChartFrame
          testID="perps-simple-market-chart"
          controlsPaddingHorizontal={20}
          rangeControlVariant="segmented"
          segmentControlStyle={SIMPLE_CHART_SEGMENT_STYLE}
          segmentLabelMinWidth={28}
          height={chartHeight}
          range={range}
          chartRanges={TOKEN_SIMPLE_CHART_RANGES}
          onRangeChange={setRange}
          modeControl={modeControl}
        >
          <SimpleMarketLineChart
            backgroundColor={chartBackground}
            key={`${coin}:${range}`}
            coin={coin}
            height={chartHeight - TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT}
            range={range}
            active={active}
            livePrice={livePrice}
            onPriceChange={onPriceChange}
          />
        </MobileSimpleChartFrame>
      ) : null}
    </Stack>
  );
}
