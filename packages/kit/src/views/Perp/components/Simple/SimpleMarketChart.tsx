import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartConstants';
import { tradingViewNativeHyperliquidGateway } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/providers/hyperliquid/tradingViewNativeHyperliquidGateway';
import {
  getTradingViewNativeSubIndicatorInstances,
  normalizeTradingViewNativeIndicatorSettings,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/indicatorSettingsAdapter';
import { TradingViewNative } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNative';
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
import { usePerpsTradingViewIndicatorSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getSimpleChartPerformance,
  getSimpleChartPoints,
  getSimpleChartRequest,
} from '../../utils/simpleChart';

import type { ISimpleChartPerformance } from '../../utils/simpleChart';

const CHART_HEIGHT = 340;
const LINE_CHART_HEIGHT =
  CHART_HEIGHT - TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT;

function SimpleMarketLineChart({
  coin,
  range,
  active,
  livePrice,
  onPerformanceChange,
}: {
  coin: string;
  range: IMobileSimpleChartRange;
  active: boolean;
  livePrice?: string;
  onPerformanceChange?: (
    performance: ISimpleChartPerformance | undefined,
  ) => void;
}) {
  const intl = useIntl();
  const { result, run } = usePromiseResult(
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

  const performance = useMemo(() => getSimpleChartPerformance(data), [data]);
  useEffect(() => {
    onPerformanceChange?.({ coin, range, ...performance });
  }, [coin, range, performance, onPerformanceChange]);

  if (!current) {
    return <Skeleton width="100%" height="100%" />;
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
      height={LINE_CHART_HEIGHT}
      pulseLastPoint
      showCurrentPriceLabel
      hoverLabelLargePrice
    />
  );
}

export function SimpleMarketChart({
  coin,
  active,
  livePrice,
  onPerformanceChange,
}: {
  coin: string;
  active: boolean;
  livePrice?: string;
  onPerformanceChange?: (
    performance: ISimpleChartPerformance | undefined,
  ) => void;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const [range, setRange] = useState<IMobileSimpleChartRange>('1D');
  const [showCandles, setShowCandles] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [indicatorSettings] = usePerpsTradingViewIndicatorSettingsPersistAtom();
  const subIndicatorCount = useMemo(
    () =>
      getTradingViewNativeSubIndicatorInstances(
        normalizeTradingViewNativeIndicatorSettings(indicatorSettings),
      ).length,
    [indicatorSettings],
  );
  const candleChartHeight =
    CHART_HEIGHT +
    subIndicatorCount * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT +
    (platformEnv.isNative ? TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT : 0);
  const source = useMemo<ITradingViewNativeSource>(
    () => ({ kind: 'hyperliquid', coin, environment: 'mainnet' }),
    [coin],
  );
  const modeControl = (
    <ChartModeButton
      testID="perps-simple-chart-mode-toggle"
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
        onPerformanceChange?.(showCandles ? { coin, range } : undefined);
        setShowCandles((value) => !value);
      }}
    />
  );

  return (
    <Stack
      height={showCandles ? candleChartHeight : CHART_HEIGHT}
      mx="$-5"
      mt="$-3"
      mb="$-4"
    >
      {showCandles ? (
        <TradingViewNative
          active={active}
          testID="perps-simple-native-chart"
          defaultBackgroundColor={
            !fullscreen && themeVariant === 'light'
              ? theme.bgSubdued.val
              : undefined
          }
          source={source}
          storageNamespace="perps"
          nativeControlsLayoutMode="mobile"
          mobileControlsPaddingHorizontal={fullscreen ? undefined : 20}
          mobileToolbarExtra={modeControl}
          enableNativeChartSettings
          nativeChartSettingsInToolbar
          showNativeIndicatorQuickBar={platformEnv.isNative}
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
          height={CHART_HEIGHT}
          range={range}
          chartRanges={TOKEN_SIMPLE_CHART_RANGES}
          onRangeChange={(nextRange) => {
            if (nextRange === range) return;
            onPerformanceChange?.({ coin, range: nextRange });
            setRange(nextRange);
          }}
          modeControl={modeControl}
        >
          <SimpleMarketLineChart
            coin={coin}
            range={range}
            active={active}
            livePrice={livePrice}
            onPerformanceChange={onPerformanceChange}
          />
        </MobileSimpleChartFrame>
      ) : null}
    </Stack>
  );
}
