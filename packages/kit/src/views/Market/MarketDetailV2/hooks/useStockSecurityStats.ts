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
  tooltip?: string;
}

function buildStatRows(items: IStatItem[]) {
  const rows: IStatItem[][] = [];

  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return rows;
}

export function useStockSecurityStats(stock: IMarketStockInfo | undefined) {
  const intl = useIntl();

  const { assetAnalysisRows, tradingActivityRows } = useMemo(() => {
    if (!stock) {
      return {
        assetAnalysisRows: [] as IStatItem[][],
        tradingActivityRows: [] as IStatItem[][],
      };
    }

    const { assetAnalysis, tradingActivity } = stock;

    const assetAnalysisItems: IStatItem[] = [
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_24h_volume,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.volume24h),
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
          : STAT_FALLBACK_VALUE,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_1y_avg_daily_vol,
        }),
        value: formatMarketCapValue(assetAnalysis?.avgDailyVolume1y),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_high,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.weekHigh52),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_low,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.weekLow52),
      },
    ];

    const tradingActivityItems: IStatItem[] = [
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
          id: ETranslations.dexmarket_stock_pb,
        }),
        value: formatRatioValue(tradingActivity?.pbRatio),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_pb_desc,
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
          id: ETranslations.dexmarket_stock_roe,
        }),
        value: formatPercentValue(tradingActivity?.roe),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roe_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roa,
        }),
        value: formatPercentValue(tradingActivity?.roa),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_roa_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_profit_margin,
        }),
        value: formatPercentValue(tradingActivity?.netProfitMargin),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_profit_margin_desc,
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_de,
        }),
        value: formatRatioValue(tradingActivity?.debtToEquity),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_de_desc,
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

    return {
      assetAnalysisRows: buildStatRows(assetAnalysisItems),
      tradingActivityRows: buildStatRows(tradingActivityItems),
    };
  }, [intl, stock]);

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
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_stock_shares_per_token_desc,
        }),
        value: stock.sharesPerToken
          ? `${stock.sharesPerToken} ${stock.underlyingAssetTicker ?? ''}`.trim()
          : STAT_FALLBACK_VALUE,
      },
    ];
  }, [intl, stock]);

  return { assetAnalysisRows, tradingActivityRows, descriptionRows };
}
