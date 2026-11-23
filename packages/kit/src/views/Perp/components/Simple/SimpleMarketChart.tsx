import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

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
import {
  STOCK_SIMPLE_CHART_POLLING_MS,
  mergeStockSimpleChartLivePrice,
  resolveStockSimpleChartMinRefreshMs,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/StockSimpleChart/stockSimpleChartData';
import {
  ChartModeButton,
  MobileSimpleChartFrame,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/MobileSimpleChart';
import type { IMobileSimpleChartRange } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/layouts/MobileSimpleChart';
import {
  useAppIsLockedAtom,
  usePerpsCustomSettingsAtom,
  usePerpsTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';
import {
  getDexIndexByAssetId,
  toCtxIndex,
} from '@onekeyhq/shared/src/utils/perpsDexUtils';
import { SUB_DEX_LIST } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IWsAllDexsAssetCtxs,
  IWsAllMids,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { usePerpsMarketDataFreshness } from '../../hooks/usePerpsMarketDataFreshness';
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

type ISimpleMarketChartHistory = {
  coin: string;
  range: IMobileSimpleChartRange;
  data: ReturnType<typeof getSimpleChartPoints>;
  intervalSeconds: number;
  fetchedAt: number;
  error: boolean;
};

function SimpleMarketLineChart({
  backgroundColor,
  coin,
  height,
  range,
  active,
  assetId,
  onPriceChange,
}: {
  backgroundColor?: string;
  coin: string;
  height: number;
  range: IMobileSimpleChartRange;
  active: boolean;
  assetId?: number;
  onPriceChange?: (price: ISimpleMarketChartPrice | undefined) => void;
}) {
  const intl = useIntl();
  const [hoverPoint, setHoverPoint] =
    useState<IStockPriceLineChartHoverPoint>();
  const lastSuccessfulHistory = useRef<ISimpleMarketChartHistory>(undefined);
  const requestId = useRef(0);
  const forceRefresh = useRef(false);
  const refreshFailed = useRef(false);
  useEffect(
    () => () => {
      // Late results from a hidden or replaced chart cannot seed its fallback.
      requestId.current += 1;
    },
    [active, coin, range],
  );
  const { result, isLoading, run } = usePromiseResult<
    ISimpleMarketChartHistory | undefined
  >(
    async () => {
      const cached = lastSuccessfulHistory.current;
      const currentCache =
        cached?.coin === coin && cached.range === range ? cached : undefined;
      const force = forceRefresh.current;
      forceRefresh.current = false;
      if (
        !force &&
        !refreshFailed.current &&
        currentCache &&
        Date.now() - currentCache.fetchedAt <
          resolveStockSimpleChartMinRefreshMs({ range })
      ) {
        return currentCache;
      }
      requestId.current += 1;
      const currentRequestId = requestId.current;
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
        const history = {
          coin,
          range,
          data: getSimpleChartPoints({ points, ...request }),
          intervalSeconds: request.intervalSeconds,
          fetchedAt: Date.now(),
          error: false,
        };
        if (requestId.current === currentRequestId) {
          lastSuccessfulHistory.current = history;
          refreshFailed.current = false;
        }
        return history;
      } catch {
        if (requestId.current === currentRequestId)
          refreshFailed.current = true;
        // Retain only this coin/range's display history. Trading readiness is
        // checked separately and must never be inferred from this fallback.
        const latest = lastSuccessfulHistory.current;
        if (latest?.coin === coin && latest.range === range)
          return { ...latest, error: true };
        return {
          coin,
          range,
          data: [],
          intervalSeconds: request.intervalSeconds,
          fetchedAt: 0,
          error: true,
        };
      }
    },
    [coin, range],
    {
      watchLoading: true,
      // Keep the timer stable; changing it delays range switches in usePromiseResult.
      pollingInterval: STOCK_SIMPLE_CHART_POLLING_MS,
      overrideIsFocused: (isFocused) => isFocused && active,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  const retry = useCallback(() => {
    forceRefresh.current = true;
    void run();
  }, [run]);
  const current =
    result?.coin === coin && result.range === range ? result : undefined;
  const { isReady } = usePerpsMarketDataFreshness();
  const [quote, setQuote] = useState<{ price: string; receivedAt: number }>();
  // Candle timestamps identify bucket starts. Even an update within the same
  // open bucket must not replace a REST close fetched after that update.
  const latestHistoryAt = Math.max(
    current?.fetchedAt ?? 0,
    (current?.data?.at(-1)?.[0] ?? 0) * 1000,
  );
  useEffect(() => {
    if (!active || !isReady) {
      setQuote(undefined);
      return;
    }
    const dexIndex = assetId === undefined ? -1 : getDexIndexByAssetId(assetId);
    const dex = dexIndex > 0 ? SUB_DEX_LIST[dexIndex - 1]?.prefix : '';
    const ctxIndex = assetId === undefined ? -1 : toCtxIndex(assetId, dexIndex);
    let latestReceivedAt = latestHistoryAt;
    const onQuote = (
      event: IAppEventBusPayload[EAppEventBusNames.HyperliquidDataUpdate],
    ) => {
      const { receivedAt } = event;
      if (!receivedAt || receivedAt < latestReceivedAt) return;
      let price: string | null | undefined;
      if (event.subType === ESubscriptionType.ALL_MIDS) {
        price = (event.data as IWsAllMids).mids?.[coin];
      } else if (
        event.subType === ESubscriptionType.ALL_DEXS_ASSET_CTXS &&
        ctxIndex >= 0
      ) {
        const ctxs = (event.data as IWsAllDexsAssetCtxs).ctxs?.find(
          ([name]) => name === dex || (!dex && name === 'perps'),
        )?.[1];
        price = ctxs?.[ctxIndex]?.midPx;
      }
      if (!price || !Number.isFinite(Number(price)) || Number(price) <= 0)
        return;
      latestReceivedAt = receivedAt;
      const next = { receivedAt, price };
      setQuote((prev) =>
        prev &&
        (prev.receivedAt > receivedAt ||
          (prev.price === next.price && prev.receivedAt >= latestHistoryAt))
          ? prev
          : next,
      );
    };
    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, onQuote);
    return () => {
      appEventBus.off(EAppEventBusNames.HyperliquidDataUpdate, onQuote);
    };
  }, [active, assetId, coin, isReady, latestHistoryAt]);
  const data = useMemo(() => {
    const points = current?.data ?? [];
    if (!isReady || !quote || quote.receivedAt < latestHistoryAt) return points;
    return mergeStockSimpleChartLivePrice({
      points,
      intervalSeconds: current?.intervalSeconds,
      livePrice: quote.price,
      nowSeconds: Math.floor(quote.receivedAt / 1000),
    });
  }, [current, isReady, latestHistoryAt, quote]);
  const hasHistory = !!current && data.length > 0;
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
  if (!data.length) {
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
            onPress={retry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        ) : null}
      </YStack>
    );
  }
  return (
    <YStack flex={1}>
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
      {current.error ? (
        <Button
          testID="perps-simple-chart-refresh-retry"
          position="absolute"
          bottom="$2"
          alignSelf="center"
          size="small"
          variant="secondary"
          onPress={retry}
        >
          {intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          })}
        </Button>
      ) : null}
    </YStack>
  );
}

export function SimpleMarketChart({
  coin,
  active,
  assetId,
  onPriceChange,
}: {
  coin: string;
  active: boolean;
  assetId?: number;
  onPriceChange?: (price: ISimpleMarketChartPrice | undefined) => void;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const [range, setRange] = useState<IMobileSimpleChartRange>('1D');
  const [{ simpleMarketChartMode }, setSettings] = usePerpsCustomSettingsAtom();
  const showCandles = simpleMarketChartMode === 'candles';
  const [fullscreen, setFullscreen] = useState(false);
  const isAppVisible = useSyncExternalStore(
    onVisibilityStateChange,
    getCurrentVisibilityState,
  );
  const [isLocked] = useAppIsLockedAtom();
  // iOS pushes a separate root route for this chart's fullscreen presentation.
  const candleActive =
    isAppVisible &&
    !isLocked &&
    (active || (platformEnv.isNativeIOS === true && fullscreen));
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
  const candleChartHeight =
    BASE_CHART_HEIGHT +
    subIndicatorCount * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT +
    TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT;
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
      height={showCandles ? candleChartHeight : BASE_CHART_HEIGHT}
      mx="$-5"
      my="$-4"
    >
      {showCandles ? (
        <PerpsNativeChart
          active={candleActive}
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
          height={BASE_CHART_HEIGHT}
          range={range}
          chartRanges={TOKEN_SIMPLE_CHART_RANGES}
          onRangeChange={setRange}
          modeControl={modeControl}
        >
          <SimpleMarketLineChart
            backgroundColor={chartBackground}
            key={`${coin}:${range}`}
            coin={coin}
            height={
              BASE_CHART_HEIGHT - TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT
            }
            range={range}
            active={active}
            assetId={assetId}
            onPriceChange={onPriceChange}
          />
        </MobileSimpleChartFrame>
      ) : null}
    </Stack>
  );
}
