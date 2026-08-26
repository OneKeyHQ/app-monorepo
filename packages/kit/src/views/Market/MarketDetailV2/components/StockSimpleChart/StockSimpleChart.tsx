import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';

export type IStockSimpleChartRange = '1H' | '1D' | '1W' | '1M' | '1Y' | 'All';

const STOCK_SIMPLE_CHART_HEIGHT = 304;
const STOCK_SIMPLE_CHART_RANGE_SECONDS: Record<
  IStockSimpleChartRange,
  number | undefined
> = {
  '1H': 60 * 60,
  '1D': 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
  '1M': 30 * 24 * 60 * 60,
  '1Y': 365 * 24 * 60 * 60,
  All: undefined,
};

const STOCK_TOKEN_CHART_INTERVALS: Record<IStockSimpleChartRange, string> = {
  '1H': '1m',
  '1D': '15m',
  '1W': '1H',
  '1M': '4H',
  '1Y': '1D',
  All: '1W',
};

type IStockSimpleChartState = {
  data: IMarketTokenChart;
  status: 'pending' | 'success' | 'error';
};

export function StockSimpleChart({ range }: { range: IStockSimpleChartRange }) {
  const intl = useIntl();
  const { isNative, networkId, tokenAddress, tokenDetail } = useTokenDetail();
  const { stockDetail } = useStockDetail();
  const rangeSeconds = STOCK_SIMPLE_CHART_RANGE_SECONDS[range];
  const tokenChartInterval = STOCK_TOKEN_CHART_INTERVALS[range];

  const {
    result: chartState,
    isLoading,
    run: retry,
  } = usePromiseResult<IStockSimpleChartState>(
    async () => {
      if (!networkId || (!tokenAddress && !isNative)) {
        return { data: [], status: 'success' };
      }

      try {
        const timeTo = Math.floor(Date.now() / 1000);
        const timeFrom = rangeSeconds ? timeTo - rangeSeconds : undefined;
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
            interval: tokenChartInterval,
            networkId,
            tokenAddress,
            timeFrom,
            timeTo,
            autoHandleError: false,
          });
        const data = response.points
          .map(
            (point) => [Number(point.t), Number(point.c)] as [number, number],
          )
          .filter(
            ([timestamp, price]) =>
              Number.isFinite(timestamp) && Number.isFinite(price),
          )
          .toSorted((a, b) => a[0] - b[0]);

        return {
          data,
          status: 'success',
        };
      } catch (_error) {
        return { data: [], status: 'error' };
      }
    },
    [isNative, networkId, rangeSeconds, tokenChartInterval, tokenAddress],
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
