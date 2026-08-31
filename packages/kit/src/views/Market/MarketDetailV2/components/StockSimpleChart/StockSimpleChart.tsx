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
} from './stockSimpleChartData';

export type { IStockSimpleChartRange } from './stockSimpleChartData';

const STOCK_SIMPLE_CHART_HEIGHT = 304;

type IStockSimpleChartState = {
  data: IMarketTokenChart;
  status: 'pending' | 'success' | 'error';
};

export function StockSimpleChart({
  coinGeckoId,
  range,
  priceMode,
  onHoverChange,
}: {
  coinGeckoId?: string;
  range: IStockSimpleChartRange;
  priceMode: IMarketPriceSource;
  // Forwarded to the line chart so the price header above can follow the
  // crosshair; called with undefined once the pointer leaves the plot.
  onHoverChange?: (point: IStockPriceLineChartHoverPoint | undefined) => void;
}) {
  const intl = useIntl();
  const { isNative, networkId, tokenAddress, tokenDetail } = useTokenDetail();
  const { stockDetail, stockId } = useStockDetail();

  const {
    result: chartState,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockSimpleChartState>(
    async () => {
      try {
        const data = await fetchStockSimpleChartPoints({
          coinGeckoId,
          isNative,
          networkId,
          priceMode,
          range,
          stockId,
          tokenAddress,
        });

        return {
          data,
          status: 'success',
        };
      } catch (_error) {
        return { data: [], status: 'error' };
      }
    },
    [coinGeckoId, isNative, networkId, priceMode, range, stockId, tokenAddress],
    {
      initResult: { data: [], status: 'pending' },
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  if (isLoading || chartState.status === 'pending') {
    return (
      <Stack
        testID="stock-simple-chart-loading"
        width="100%"
        height={STOCK_SIMPLE_CHART_HEIGHT}
      >
        <Skeleton width="100%" height={STOCK_SIMPLE_CHART_HEIGHT} />
      </Stack>
    );
  }

  if (chartState.status === 'error') {
    return (
      <YStack
        width="100%"
        height={STOCK_SIMPLE_CHART_HEIGHT}
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
  }

  if (!chartState.data.length) {
    return (
      <YStack
        width="100%"
        height={STOCK_SIMPLE_CHART_HEIGHT}
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
  }

  return (
    <StockPriceLineChart
      testID="stock-simple-chart-content"
      data={chartState.data}
      height={STOCK_SIMPLE_CHART_HEIGHT}
      pulseLastPoint={
        stockDetail?.marketStatus?.isOpen === true ||
        tokenDetail?.stock?.isOpen === true
      }
      // The stock detail page redirects its own price header to the hovered
      // point, so a price inside the crosshair label would repeat it.
      hoverLabelShowsPrice={false}
      onHoverChange={onHoverChange}
    />
  );
}
