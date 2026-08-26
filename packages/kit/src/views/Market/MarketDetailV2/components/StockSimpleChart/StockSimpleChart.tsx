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
  range,
  priceMode,
}: {
  range: IStockSimpleChartRange;
  priceMode: 'share' | 'token';
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
    [isNative, networkId, priceMode, range, stockId, tokenAddress],
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
    />
  );
}
