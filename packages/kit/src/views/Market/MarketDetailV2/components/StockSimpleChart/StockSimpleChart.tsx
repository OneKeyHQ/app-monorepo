import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
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
import { useTokenDetail } from '../../hooks/useTokenDetail';

import {
  type IStockSimpleChartRange,
  fetchStockSimpleChartPoints,
  mergeStockSimpleChartLivePrice,
  resolveStockSimpleChartBucketSeconds,
  resolveStockSimpleChartLivePrice,
  resolveStockSimpleChartPreviousClose,
  resolveStockSimpleChartPulseLastPoint,
  resolveStockSimpleChartRequestScope,
} from './stockSimpleChartData';

export type { IStockSimpleChartRange } from './stockSimpleChartData';

// Pre-measure fallback: the 456px default chart block minus its 40px toolbar
// row and 16px gap; onLayout below tracks the real (resizable) height.
const STOCK_SIMPLE_CHART_INITIAL_HEIGHT = 400;

type IStockSimpleChartState = {
  requestKey: string;
  data: IMarketTokenChart;
  status: 'pending' | 'success' | 'error';
};

type IStockSimpleChartProps = {
  coinGeckoId?: string;
  marketAssetId?: string;
  range: IStockSimpleChartRange;
  priceMode: IMarketPriceSource;
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
  coinGeckoId,
  marketAssetId,
  range,
  priceMode,
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
  const intervalSeconds = resolveStockSimpleChartBucketSeconds({
    coinGeckoId: requestCoinGeckoId,
    marketAssetId: requestMarketAssetId,
    priceMode: requestPriceMode,
    range: requestRange,
  });

  const {
    result: chartState,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockSimpleChartState>(
    async () => {
      if (!requestReady) return { requestKey, data: [], status: 'pending' };
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

        return {
          requestKey,
          data,
          status: 'success',
        };
      } catch (_error) {
        return { requestKey, data: [], status: 'error' };
      }
    },
    [
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
    ],
    {
      initResult: { requestKey, data: [], status: 'pending' },
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  // `Date.now()` is read during the memo rather than tracked as a dependency:
  // the tail point only needs a fresh timestamp when the quote it carries
  // changes. Ticking it on a timer would redraw the line without moving it.
  const chartData = useMemo(
    () =>
      mergeStockSimpleChartLivePrice({
        intervalSeconds,
        livePrice,
        nowSeconds: Math.floor(Date.now() / 1000),
        points: chartState.data,
      }),
    [chartState.data, intervalSeconds, livePrice],
  );

  let chartContent;
  if (
    !requestReady ||
    chartState.requestKey !== requestKey ||
    isLoading ||
    chartState.status === 'pending'
  ) {
    chartContent = (
      <Stack testID="stock-simple-chart-loading" width="100%" height="100%">
        <Skeleton width="100%" height="100%" />
      </Stack>
    );
  } else if (chartState.status === 'error') {
    chartContent = (
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
          onPress={() => void retry()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
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
