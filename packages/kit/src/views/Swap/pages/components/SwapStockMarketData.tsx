import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Popover, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
  formatRatioValue,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/statValue';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { SwapTestIDs } from '../../testIDs';
type IStockMarketTokenDetail = IMarketTokenDetail | undefined;
type IStockMarketDataRow = { label: string; value: string; tooltip?: string };
function StockMarketDataItem({
  compact,
  label,
  value,
  tooltip,
}: {
  compact?: boolean;
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <YStack
      flexGrow={1}
      flexBasis={0}
      minWidth={0}
      h={44}
      px={compact ? '$3' : '$3.5'}
      py="$0.5"
      borderRadius="$3"
      bg="$bgSubdued"
      justifyContent="space-between"
    >
      <XStack alignItems="center" gap="$1" minWidth={0} h="$4">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </SizableText>
        {tooltip ? (
          <Popover.Tooltip
            iconSize="$4"
            title={label}
            tooltip={tooltip}
            placement="top"
            renderContent={
              <YStack p="$5">
                <SizableText size="$bodyMd">{tooltip}</SizableText>
              </YStack>
            }
          />
        ) : null}
      </XStack>
      <SizableText
        size={compact ? '$bodySmMedium' : '$bodyLg'}
        color="$text"
        numberOfLines={1}
      >
        {value}
      </SizableText>
    </YStack>
  );
}

function buildStockMarketDataRows({
  intl,
  tokenDetail,
}: {
  intl: ReturnType<typeof useIntl>;
  tokenDetail?: IStockMarketTokenDetail;
}): IStockMarketDataRow[] {
  const assetAnalysis = tokenDetail?.stock?.assetAnalysis;
  const tradingActivity = tokenDetail?.stock?.tradingActivity;
  return [
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_24h_volume,
      }),
      value: formatCurrencyStatValue(
        assetAnalysis?.volume24h ?? tokenDetail?.volume24h,
      ),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_volume_shares,
      }),
      value: formatMarketCapValue(assetAnalysis?.volumeShares),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_turnover_rate,
      }),
      value: assetAnalysis?.turnoverRate
        ? `${formatMarketCapValue(assetAnalysis.turnoverRate)}%`
        : '--',
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_pe_ttm,
      }),
      value: formatRatioValue(tradingActivity?.peRatio),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_stock_pe_ttm_desc,
      }),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_ps,
      }),
      value: formatRatioValue(tradingActivity?.psRatio),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_stock_ps_desc,
      }),
    },
    {
      label: intl.formatMessage({
        id: ETranslations.dexmarket_stock_dividend_yield,
      }),
      value: formatPercentValue(tradingActivity?.dividendYield),
      tooltip: intl.formatMessage({
        id: ETranslations.dexmarket_stock_dividend_yield_desc,
      }),
    },
  ];
}

function StockMarketDataGridContent({
  compact,
  rows,
  testID,
}: {
  compact?: boolean;
  rows: IStockMarketDataRow[];
  testID: string;
}) {
  const intl = useIntl();
  const rowGap = compact ? '$2' : '$3';

  return (
    <YStack
      w="100%"
      gap={rowGap}
      minHeight={compact ? undefined : 196}
      testID={testID}
    >
      <SizableText
        size={compact ? '$bodySmMedium' : '$bodyMdMedium'}
        color="$text"
      >
        {intl.formatMessage({ id: ETranslations.trade_stock_market_data })}
      </SizableText>
      <YStack w="100%" gap={compact ? rowGap : '$3.5'}>
        {[0, 2, 4].map((rowStart) => (
          <XStack
            key={rowStart}
            gap={compact ? rowGap : '$4'}
            w="100%"
            alignItems="stretch"
          >
            {rows.slice(rowStart, rowStart + 2).map((item) => (
              <StockMarketDataItem
                key={item.label}
                compact={compact}
                label={item.label}
                value={item.value}
                tooltip={item.tooltip}
              />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export function SwapStockMarketDataGrid({
  tokenDetail,
}: {
  tokenDetail?: IStockMarketTokenDetail;
}) {
  const intl = useIntl();
  const rows = useMemo(
    () =>
      buildStockMarketDataRows({
        intl,
        tokenDetail,
      }),
    [intl, tokenDetail],
  );

  return (
    <StockMarketDataGridContent
      rows={rows}
      testID={SwapTestIDs.stockMarketDataGrid}
    />
  );
}
