import { useMemo } from 'react';

import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import {
  STAT_FALLBACK_VALUE,
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
  formatRatioValue,
} from '../utils/statValue';

import type { IStatItem } from '../components/TokenOverview/components/StatCard';

export interface IDescriptionRow {
  key: string;
  label: string;
  value: string;
}

export function useStockSecurityStats(stock: IMarketStockInfo | undefined) {
  const statRows = useMemo(() => {
    if (!stock) return [] as IStatItem[][];
    const items: IStatItem[] = [
      {
        label: '24h Volume',
        value: formatCurrencyStatValue(stock.volume24h),
      },
      {
        label: 'Volume (Shares)',
        value: formatMarketCapValue(stock.volumeShares),
      },
      {
        label: 'Turnover Rate',
        value: stock.turnoverRate
          ? `${formatMarketCapValue(stock.turnoverRate)}%`
          : STAT_FALLBACK_VALUE,
        tooltip:
          'The ratio of shares traded to total shares outstanding over a given period.',
      },
      {
        label: '1y Avg. Daily Vol',
        value: formatMarketCapValue(stock.avgDailyVolume1y),
        tooltip: 'The average daily trading volume over the past year.',
      },
      {
        label: '52-Week High',
        value: formatCurrencyStatValue(stock.weekHigh52),
        tooltip: 'The highest price reached during the past 52 weeks.',
      },
      {
        label: '52-Week Low',
        value: formatCurrencyStatValue(stock.weekLow52),
        tooltip: 'The lowest price reached during the past 52 weeks.',
      },
      {
        label: 'P/E TTM',
        value: formatRatioValue(stock.peRatio),
        tooltip: 'Price-to-Earnings ratio (Trailing Twelve Months).',
      },
      {
        label: 'P/B',
        value: formatRatioValue(stock.pbRatio),
        tooltip: 'Price-to-Book ratio.',
      },
      {
        label: 'P/S',
        value: formatRatioValue(stock.psRatio),
        tooltip: 'Price-to-Sales ratio.',
      },
      {
        label: 'ROE',
        value: formatPercentValue(stock.roe),
        tooltip: 'Return on Equity.',
      },
      {
        label: 'ROA',
        value: formatPercentValue(stock.roa),
        tooltip: 'Return on Assets.',
      },
      {
        label: 'Profit Margin',
        value: formatPercentValue(stock.netProfitMargin),
        tooltip: 'Net profit margin.',
      },
      {
        label: 'D/E',
        value: formatRatioValue(stock.debtToEquity),
        tooltip: 'Debt-to-Equity ratio.',
      },
      {
        label: 'Dividend Yield',
        value: formatPercentValue(stock.dividendYield),
        tooltip: 'Annual dividend yield.',
      },
    ];
    const rows: IStatItem[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stock?.volume24h,
    stock?.volumeShares,
    stock?.turnoverRate,
    stock?.avgDailyVolume1y,
    stock?.weekHigh52,
    stock?.weekLow52,
    stock?.peRatio,
    stock?.pbRatio,
    stock?.psRatio,
    stock?.roe,
    stock?.roa,
    stock?.netProfitMargin,
    stock?.debtToEquity,
    stock?.dividendYield,
  ]);

  const descriptionRows = useMemo<IDescriptionRow[]>(() => {
    if (!stock) return [];
    return [
      {
        key: 'underlyingTicker',
        label: 'Underlying Asset Ticker',
        value: stock.underlyingAssetTicker ?? STAT_FALLBACK_VALUE,
      },
      {
        key: 'underlyingName',
        label: 'Underlying Asset Name',
        value: stock.underlyingAssetName ?? STAT_FALLBACK_VALUE,
      },
      {
        key: 'sharesPerToken',
        label: 'Shares Per Token',
        value: stock.sharesPerToken
          ? `${stock.sharesPerToken} ${stock.underlyingAssetTicker ?? ''}`.trim()
          : STAT_FALLBACK_VALUE,
      },
      {
        key: 'lastDividend',
        label: 'Last Dividend',
        value: stock.dividendPerShare
          ? `$${formatRatioValue(stock.dividendPerShare)}`
          : STAT_FALLBACK_VALUE,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stock?.underlyingAssetTicker,
    stock?.underlyingAssetName,
    stock?.sharesPerToken,
    stock?.dividendPerShare,
  ]);

  return { statRows, descriptionRows };
}
