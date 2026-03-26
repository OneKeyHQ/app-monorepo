import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();

  const statRows = useMemo(() => {
    if (!stock) return [] as IStatItem[][];
    const items: IStatItem[] = [
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_24h_volume,
        }),
        value: formatCurrencyStatValue(stock.volume24h),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_volume_shares,
        }),
        value: formatMarketCapValue(stock.volumeShares),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_turnover_rate,
        }),
        value: stock.turnoverRate
          ? `${formatMarketCapValue(stock.turnoverRate)}%`
          : STAT_FALLBACK_VALUE,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_1y_avg_daily_vol,
        }),
        value: formatMarketCapValue(stock.avgDailyVolume1y),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_high,
        }),
        value: formatCurrencyStatValue(stock.weekHigh52),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_low,
        }),
        value: formatCurrencyStatValue(stock.weekLow52),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pe_ttm,
        }),
        value: formatRatioValue(stock.peRatio),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pe_ttm_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pb,
        }),
        value: formatRatioValue(stock.pbRatio),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pb_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_ps,
        }),
        value: formatRatioValue(stock.psRatio),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_ps_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roe,
        }),
        value: formatPercentValue(stock.roe),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roe_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roa,
        }),
        value: formatPercentValue(stock.roa),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roa_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_profit_margin,
        }),
        value: formatPercentValue(stock.netProfitMargin),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_profit_margin_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_de,
        }),
        value: formatRatioValue(stock.debtToEquity),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_de_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_dividend_yield,
        }),
        value: formatPercentValue(stock.dividendYield),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_dividend_yield_desc,
        }),
      },
    ];
    const rows: IStatItem[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    intl,
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
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_underlying_asset_ticker,
        }),
        value: stock.underlyingAssetTicker ?? STAT_FALLBACK_VALUE,
      },
      {
        key: 'underlyingName',
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_underlying_asset_name,
        }),
        value: stock.underlyingAssetName ?? STAT_FALLBACK_VALUE,
      },
      {
        key: 'sharesPerToken',
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_shares_per_token,
        }),
        value: stock.sharesPerToken
          ? `${stock.sharesPerToken} ${stock.underlyingAssetTicker ?? ''}`.trim()
          : STAT_FALLBACK_VALUE,
      },
      {
        key: 'lastDividend',
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_dividend_yield,
        }),
        value: stock.dividendPerShare
          ? `$${formatRatioValue(stock.dividendPerShare)}`
          : STAT_FALLBACK_VALUE,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    intl,
    stock?.underlyingAssetTicker,
    stock?.underlyingAssetName,
    stock?.sharesPerToken,
    stock?.dividendPerShare,
  ]);

  return { statRows, descriptionRows };
}
