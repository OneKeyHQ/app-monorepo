// cspell:ignore financials
import type {
  IStockFinancialReportingPeriod,
  IStockFinancials,
} from '@onekeyhq/shared/types/marketStockFinancials';

import {
  buildFinancialWaterfall,
  getFinancialPeriodLabel,
  getFinancialRows,
  getNetMargin,
  isFinancialNumber,
} from './financialsUtils';

import type {
  IFinancialChartRow,
  IFinancialChartSeries,
} from './FinancialChart';
import type { IFinancialWaterfallKey } from './financialsUtils';

export type IFinancialChartKind =
  | 'performance'
  | 'conversion'
  | 'debt'
  | 'earnings';

export type IStockFinancialLabels = Record<IFinancialWaterfallKey, string> & {
  financials: string;
  annual: string;
  quarter: string;
  performance: string;
  conversion: string;
  debt: string;
  earnings: string;
  netMargin: string;
  totalDebt: string;
  freeCashFlow: string;
  cashAndCashEquivalents: string;
  actual: string;
  estimate: string;
  partial: string;
  simplified: string;
  next: string;
};

const COLORS = {
  blue: '#5879EA',
  cyan: '#69B8C4',
  orange: '#D28A46',
  green: '#56A58F',
  red: '#D35B82',
};

function getWaterfallColor(
  key: IFinancialWaterfallKey,
  total: boolean,
  value: number,
) {
  if (total) return key === 'revenue' ? COLORS.green : COLORS.blue;
  return value < 0 ? COLORS.red : COLORS.green;
}

export function buildFinancialChart(
  data: IStockFinancials | null | undefined,
  kind: IFinancialChartKind,
  labels: IStockFinancialLabels,
): {
  rows: IFinancialChartRow[];
  series: IFinancialChartSeries[];
  simplified: boolean;
  currency?: string;
} {
  const empty = { rows: [], series: [], simplified: false };
  if (!data) return empty;
  let sourceRows: IStockFinancialReportingPeriod[] = [];
  if (kind === 'performance') sourceRows = data.performance;
  if (kind === 'debt') sourceRows = data.debtLevelAndCoverage;
  if (kind === 'earnings') sourceRows = data.earnings.items;
  if (kind === 'conversion' && data.revenueToProfitConversion)
    sourceRows = [data.revenueToProfitConversion];
  const currency =
    data.currency ??
    sourceRows.find((row) => row.reportedCurrency)?.reportedCurrency;
  const bar = (
    key: string,
    label: string,
    color: string,
  ): IFinancialChartSeries => ({ key, label, color, kind: 'bar' });
  if (kind === 'conversion') {
    const conversion = data.revenueToProfitConversion;
    if (
      !conversion ||
      !getFinancialRows([conversion], data.period, currency).length
    )
      return empty;
    const waterfall = buildFinancialWaterfall(conversion);
    return {
      currency,
      simplified: waterfall.simplified,
      series: [],
      rows: waterfall.bars.map((item) => ({
        key: item.key,
        label: labels[item.key],
        values: [item.value],
        range: {
          start: item.start,
          end: item.end,
          connect: !waterfall.simplified,
          color: getWaterfallColor(item.key, item.total, item.value),
        },
      })),
    };
  }
  if (kind === 'performance') {
    return {
      currency,
      simplified: false,
      series: [
        bar('revenue', labels.revenue, COLORS.blue),
        bar('netIncome', labels.netIncome, COLORS.cyan),
        {
          key: 'margin',
          label: labels.netMargin,
          color: COLORS.orange,
          kind: 'line',
        },
      ],
      rows: getFinancialRows(data.performance, data.period, currency).map(
        (row) => ({
          key: row.date,
          label: getFinancialPeriodLabel(row),
          values: [
            row.revenue,
            row.netIncome,
            getNetMargin(row.revenue, row.netIncome),
          ],
        }),
      ),
    };
  }
  if (kind === 'debt') {
    return {
      currency,
      simplified: false,
      series: [
        bar('debt', labels.totalDebt, COLORS.red),
        bar('fcf', labels.freeCashFlow, COLORS.cyan),
        bar('cash', labels.cashAndCashEquivalents, COLORS.blue),
      ],
      rows: getFinancialRows(
        data.debtLevelAndCoverage,
        data.period,
        currency,
      ).map((row) => ({
        key: row.date,
        label: getFinancialPeriodLabel(row),
        values: [row.totalDebt, row.freeCashFlow, row.cashAndCashEquivalents],
      })),
    };
  }
  return {
    currency,
    simplified: false,
    series: [
      {
        key: 'actual',
        label: labels.actual,
        color: COLORS.green,
        kind: 'actual',
      },
      {
        key: 'estimate',
        label: labels.estimate,
        color: COLORS.green,
        kind: 'estimate',
      },
    ],
    rows: getFinancialRows(data.earnings.items, data.period, currency).map(
      (row) => ({
        key: row.date,
        label: getFinancialPeriodLabel(row),
        values: [
          row.actual,
          data.period === 'annual' &&
          (!isFinancialNumber(row.numAnalysts) || row.numAnalysts < 3)
            ? null
            : row.estimate,
        ],
      }),
    ),
  };
}
