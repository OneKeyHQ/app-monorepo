import { useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockPublicDetail,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { useMarketKlineLivePrice } from '../../hooks/useMarketKlineLivePrice';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import { resolveMarketKlineLivePriceEnabled } from '../../utils/marketKlineLivePrice';

import {
  type IStockSimpleChartRange,
  STOCK_SIMPLE_CHART_POLLING_MS,
  buildStockSimpleChartScopeKey,
  fetchStockSimpleChartPoints,
  resolveStockSimpleChartBucketSeconds,
  resolveStockSimpleChartClipKey,
  resolveStockSimpleChartDisplayPoints,
  resolveStockSimpleChartLivePrice,
  resolveStockSimpleChartMinRefreshMs,
  resolveStockSimpleChartPreviousClose,
  resolveStockSimpleChartPulseLastPoint,
  resolveStockSimpleChartRequestScope,
  shouldStoreStockSimpleChartSeries,
} from './stockSimpleChartData';

export type { IStockSimpleChartRange } from './stockSimpleChartData';

// Pre-measure fallback: the 456px default chart block minus its 40px toolbar
// row and 16px gap; onLayout below tracks the real (resizable) height.
const STOCK_SIMPLE_CHART_INITIAL_HEIGHT = 400;

type IStockSimpleChartState = {
  requestKey: string;
  data: IMarketTokenChart;
  status: 'pending' | 'success' | 'error';
  // Which asset and window this series was loaded for. `usePromiseResult` keeps
  // the previous result until the next one lands, so without this the chart
  // would draw the old line under the new range's axis and quote.
  scopeKey: string;
};

type IStockSimpleChartProps = {
  active?: boolean;
  coinGeckoId?: string;
  marketAssetId?: string;
  onRequestRetry?: () => void;
  range: IStockSimpleChartRange;
  priceMode: IMarketPriceSource;
  requestError?: boolean;
};

export function StockSimpleChart(props: IStockSimpleChartProps) {
  const { isNative, networkId, tokenAddress, tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();
  return (
    <StockSimpleChartContent
      {...props}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
      tokenDetail={tokenDetail}
      stockDetail={stockDetail}
      stockId={stockId}
    />
  );
}

// Entry adapters own the asset identity; the chart never reads another page's atoms.
export function StockSimpleChartContent({
  active = true,
  coinGeckoId,
  marketAssetId,
  onRequestRetry,
  range,
  priceMode,
  requestError = false,
  isNative,
  networkId,
  tokenAddress,
  tokenDetail,
  stockDetail,
  stockId,
}: IStockSimpleChartProps & {
  isNative: boolean;
  networkId: string;
  tokenAddress: string;
  tokenDetail?: IMarketTokenDetail;
  stockDetail?: IMarketStockPublicDetail | null;
  stockId?: string;
}) {
  const intl = useIntl();
  const [chartHeight, setChartHeight] = useState(
    STOCK_SIMPLE_CHART_INITIAL_HEIGHT,
  );
  const { id: currencyId } = useCurrency();
  const {
    coinGeckoId: requestCoinGeckoId,
    isNative: requestIsNative,
    marketAssetId: requestMarketAssetId,
    networkId: requestNetworkId,
    priceMode: requestPriceMode,
    range: requestRange,
    stockId: requestStockId,
    tokenAddress: requestTokenAddress,
  } = resolveStockSimpleChartRequestScope({
    coinGeckoId,
    isNative,
    marketAssetId,
    networkId,
    priceMode,
    range,
    stockId,
    tokenAddress,
  });

  const requestKey = JSON.stringify([
    requestCoinGeckoId,
    requestIsNative,
    requestMarketAssetId,
    requestNetworkId,
    requestPriceMode,
    requestRange,
    requestStockId,
    requestTokenAddress,
  ]);
  const requestReady =
    requestPriceMode === 'share'
      ? Boolean(requestStockId)
      : Boolean(
          requestMarketAssetId ||
          requestCoinGeckoId ||
          (requestNetworkId && (requestTokenAddress || requestIsNative)),
        );

  const previousClose = resolveStockSimpleChartPreviousClose({
    priceMode: requestPriceMode,
    range: requestRange,
    stockDetail,
  });
  const pulseLastPoint = resolveStockSimpleChartPulseLastPoint({
    stockDetail,
    stockId,
    tokenStock: tokenDetail?.stock,
  });
  const livePrice = resolveStockSimpleChartLivePrice({
    priceMode: requestPriceMode,
    stockDetail,
    tokenDetail,
  });
  // This chart pins its last point to the quote above, so a quote that stops
  // moving freezes the chart with it. Simple mode mounts no TradingView, which
  // is what keeps that quote on the traded price everywhere else.
  useMarketKlineLivePrice({
    enabled:
      active &&
      requestReady &&
      resolveMarketKlineLivePriceEnabled({
        currencyId,
        isNative: requestIsNative,
        marketAssetId: requestMarketAssetId,
        networkId: requestNetworkId,
        priceMode: requestPriceMode,
        tokenAddress: requestTokenAddress,
      }),
    networkId: requestNetworkId,
    tokenAddress: requestTokenAddress,
  });
  const intervalSeconds = resolveStockSimpleChartBucketSeconds({
    coinGeckoId: requestCoinGeckoId,
    marketAssetId: requestMarketAssetId,
    priceMode: requestPriceMode,
    range: requestRange,
  });

  const scopeKey = buildStockSimpleChartScopeKey({
    coinGeckoId: requestCoinGeckoId,
    marketAssetId: requestMarketAssetId,
    networkId: requestNetworkId,
    priceMode: requestPriceMode,
    range: requestRange,
    stockId: requestStockId,
    tokenAddress: requestTokenAddress,
  });
  // Keyed by scope so a failed refresh can fall back to the line already on
  // screen, while a range or token switch never redraws the previous asset.
  const lastLoadedRef = useRef<
    | { key: string; data: IMarketTokenChart; loadedAt: number; seq: number }
    | undefined
  >(undefined);
  // A late response from a scope the user already left must not overwrite the
  // fallback that belongs to the current one.
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;
  // Two refreshes of the same scope can overlap, and the later one can answer
  // first. Ordering the writes keeps an older series from being restored by the
  // paced polls that read this fallback.
  const requestSeqRef = useRef(0);
  const minRefreshMs = resolveStockSimpleChartMinRefreshMs({
    range: requestRange,
  });

  const {
    result: chartState,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockSimpleChartState>(
    async () => {
      const cached = lastLoadedRef.current;
      const isCachedScope = cached?.key === scopeKey && cached.data.length > 0;
      // A retained Desktop/Web route keeps this chart mounted after another
      // route takes over the shared detail state, and focus checks are off here,
      // so ownership is what stops the requests. The interval identity stays
      // untouched, which lets the route refetch as soon as it is active again.
      if (!active) {
        return isCachedScope
          ? { requestKey, data: cached.data, scopeKey, status: 'success' }
          : { requestKey, data: [], scopeKey: '', status: 'pending' };
      }

      if (!requestReady) {
        return { requestKey, data: [], scopeKey, status: 'pending' };
      }

      requestSeqRef.current += 1;
      const seq = requestSeqRef.current;
      // One polling interval serves every range, so the per-range pace is
      // enforced here. A scope change skips this and reloads immediately.
      if (isCachedScope && Date.now() - cached.loadedAt < minRefreshMs) {
        return { requestKey, data: cached.data, scopeKey, status: 'success' };
      }

      try {
        const data = await fetchStockSimpleChartPoints({
          coinGeckoId: requestCoinGeckoId,
          isNative: requestIsNative,
          marketAssetId: requestMarketAssetId,
          networkId: requestNetworkId,
          priceMode: requestPriceMode,
          range: requestRange,
          stockId: requestStockId,
          tokenAddress: requestTokenAddress,
        });

        if (
          shouldStoreStockSimpleChartSeries({
            currentScopeKey: scopeKeyRef.current,
            requestScopeKey: scopeKey,
            requestSeq: seq,
            storedSeq: lastLoadedRef.current?.seq,
          })
        ) {
          lastLoadedRef.current = {
            key: scopeKey,
            data,
            loadedAt: Date.now(),
            seq,
          };
        }
        return {
          requestKey,
          data,
          scopeKey,
          status: 'success',
        };
      } catch (_error) {
        // Refreshes run unattended, so a single failed one must not replace a
        // drawn line with the error state.
        const lastLoaded = lastLoadedRef.current;
        if (lastLoaded?.key === scopeKey && lastLoaded.data.length) {
          return {
            requestKey,
            data: lastLoaded.data,
            scopeKey,
            status: 'success',
          };
        }
        return { requestKey, data: [], scopeKey, status: 'error' };
      }
    },
    [
      active,
      requestCoinGeckoId,
      requestIsNative,
      requestMarketAssetId,
      requestNetworkId,
      requestPriceMode,
      requestRange,
      requestStockId,
      requestTokenAddress,
      requestKey,
      requestReady,
      minRefreshMs,
      scopeKey,
    ],
    {
      initResult: {
        requestKey,
        data: [],
        scopeKey: '',
        status: 'pending',
      },
      watchLoading: true,
      checkIsFocused: false,
      // Without this the series stops at mount time and only its pinned tail
      // moves, drawing the time since as one straight segment.
      pollingInterval: STOCK_SIMPLE_CHART_POLLING_MS,
      revalidateOnReconnect: true,
    },
  );

  const isMarketOpen = stockDetail?.marketStatus?.isOpen;
  // `keep` vs `clip` flips at session/weekend/open boundaries. The live tail
  // still uses Date.now() inside the memo so a timer does not redraw the line.
  const chartClipKey = resolveStockSimpleChartClipKey({
    isOpen: isMarketOpen,
    nowSeconds: Math.floor(Date.now() / 1000),
    priceMode: requestPriceMode,
    range: requestRange,
  });
  const chartData = useMemo(
    () =>
      resolveStockSimpleChartDisplayPoints({
        clipKey: chartClipKey,
        intervalSeconds,
        isOpen: isMarketOpen,
        livePrice,
        nowSeconds: Math.floor(Date.now() / 1000),
        points: chartState.data,
        priceMode: requestPriceMode,
        range: requestRange,
      }),
    [
      chartClipKey,
      chartState.data,
      intervalSeconds,
      isMarketOpen,
      livePrice,
      requestPriceMode,
      requestRange,
    ],
  );

  let chartContent;
  // A refresh of the current scope keeps its line on screen, since every polling
  // tick re-enters the loading state. A result belonging to a scope the user has
  // left is not shown at all: it would sit under the new range's axis and quote.
  const isCurrentScopeLoaded = chartState.scopeKey === scopeKey;
  const renderChartError = (onRetry: () => void) => (
    <YStack
      testID="stock-simple-chart-error"
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      gap="$2"
    >
      <Icon name="InfoCircleOutline" size="$6" color="$iconSubdued" />
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.global_unknown_error_retry_message,
        })}
      </SizableText>
      <Button
        testID="stock-simple-chart-retry"
        size="small"
        variant="tertiary"
        onPress={onRetry}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  );
  if (requestError) {
    chartContent = renderChartError(() => onRequestRetry?.());
  } else if (
    !requestReady ||
    chartState.requestKey !== requestKey ||
    chartState.status === 'pending' ||
    !isCurrentScopeLoaded ||
    (isLoading && !chartState.data.length)
  ) {
    chartContent = (
      <Stack testID="stock-simple-chart-loading" width="100%" height="100%">
        <Skeleton width="100%" height="100%" />
      </Stack>
    );
  } else if (chartState.status === 'error') {
    chartContent = renderChartError(() => void retry());
  } else if (!chartState.data.length) {
    chartContent = (
      <YStack
        testID="stock-simple-chart-empty"
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        <Icon name="ChartLine2Outline" size="$6" color="$iconSubdued" />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.dexmarket_k_line_no_recent_transactions,
          })}
        </SizableText>
      </YStack>
    );
  } else {
    chartContent = (
      <StockPriceLineChart
        testID="stock-simple-chart-content"
        data={chartData}
        height={chartHeight}
        pulseLastPoint={pulseLastPoint}
        previousClose={previousClose}
        showCurrentPriceLabel
        hoverLabelLargePrice
      />
    );
  }

  return (
    <Stack
      width="100%"
      flex={1}
      minHeight={0}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== chartHeight) {
          setChartHeight(nextHeight);
        }
      }}
    >
      {chartContent}
    </Stack>
  );
}
