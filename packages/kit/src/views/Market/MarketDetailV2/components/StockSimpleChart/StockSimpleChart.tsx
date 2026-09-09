import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import {
  type IStockPriceLineChartHoverPoint,
  StockPriceLineChart,
} from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';

import {
  type IStockSimpleChartRange,
  fetchStockSimpleChartPoints,
  resolveStockSimpleChartRequestScope,
} from './stockSimpleChartData';

export type { IStockSimpleChartRange } from './stockSimpleChartData';

// Pre-measure fallback: the 456px default chart block minus its 40px toolbar
// row and 16px gap; onLayout below tracks the real (resizable) height.
const STOCK_SIMPLE_CHART_INITIAL_HEIGHT = 400;

type IStockSimpleChartState = {
  data: IMarketTokenChart;
  status: 'pending' | 'success' | 'error';
};

export function StockSimpleChart({
  coinGeckoId,
  marketAssetId,
  range,
  priceMode,
  onHoverChange,
}: {
  coinGeckoId?: string;
  marketAssetId?: string;
  range: IStockSimpleChartRange;
  priceMode: IMarketPriceSource;
  // Forwarded to the line chart so the price header above can follow the
  // crosshair; called with undefined once the pointer leaves the plot.
  onHoverChange?: (point: IStockPriceLineChartHoverPoint | undefined) => void;
}) {
  const intl = useIntl();
  const [chartHeight, setChartHeight] = useState(
    STOCK_SIMPLE_CHART_INITIAL_HEIGHT,
  );
  const { isNative, networkId, tokenAddress, tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();
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

  const {
    result: chartState,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockSimpleChartState>(
    async () => {
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
          data,
          status: 'success',
        };
      } catch (_error) {
        return { data: [], status: 'error' };
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
    ],
    {
      initResult: { data: [], status: 'pending' },
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  let chartContent;
  if (isLoading || chartState.status === 'pending') {
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
        data={chartState.data}
        height={chartHeight}
        pulseLastPoint={
          stockDetail?.marketStatus?.isOpen === true ||
          tokenDetail?.stock?.isOpen === true
        }
        // Design decision: the hover card keeps its price even though the
        // price header above also mirrors the hovered point.
        hoverLabelShowsPrice
        onHoverChange={onHoverChange}
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
