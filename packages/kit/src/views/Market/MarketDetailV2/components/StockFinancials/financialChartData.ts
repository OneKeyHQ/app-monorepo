// cspell:ignore financials
import type {
  IStockFinancialReportingPeriod,
  IStockFinancials,
} from '@onekeyhq/shared/types/marketStockFinancials';

import {
  buildFinancialWaterfall,
  getFinancialEarningsRows,
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
  expensesAndAdjustments: string;
};

const COLORS = {
  blue: 'blue9',
  cyan: 'teal9',
  orange: 'orange9',
  green: 'teal9',
  red: 'red9',
} as const;

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
  compactConversion = false,
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
    sourceRows.find((row) => row.reportedCurrency)?.reportedCurrency ??
    'USD';
  const bar = (
    key: string,
    label: string,
    color: IFinancialChartSeries['color'],
  ): IFinancialChartSeries => ({ key, label, color, kind: 'bar' });
  if (kind === 'conversion') {
    const conversion = data.revenueToProfitConversion;
    if (
      !conversion ||
      !getFinancialRows([conversion], data.period, currency).length
    )
      return empty;
    const waterfall = buildFinancialWaterfall(conversion);
    let bars = waterfall.bars;
    const grossProfit = bars.find((item) => item.key === 'grossProfit');
    const netIncome = bars.find((item) => item.key === 'netIncome');
    const collapsed =
      compactConversion &&
      !waterfall.simplified &&
      grossProfit !== undefined &&
      netIncome !== undefined;
    if (collapsed) {
      bars = bars.filter((item) =>
        ['revenue', 'costOfRevenue', 'grossProfit', 'netIncome'].includes(
          item.key,
        ),
      );
    }
    const rows: IFinancialChartRow[] = bars.map((item) => ({
      key: item.key,
      label: labels[item.key],
      values: [item.value],
      range: {
        start: item.start,
        end: item.end,
        connect: !waterfall.simplified,
        color: getWaterfallColor(item.key, item.total, item.value),
      },
    }));
    if (collapsed) {
      // Collapse only a reconciled waterfall; never invent a residual for missing accounts.
      const value = netIncome.value - grossProfit.value;
      rows.splice(3, 0, {
        key: 'expensesAndAdjustments',
        label: labels.expensesAndAdjustments,
        values: [value],
        range: {
          start: grossProfit.value,
          end: netIncome.value,
          connect: true,
          color: value < 0 ? COLORS.red : COLORS.green,
        },
        details: waterfall.bars
          .filter((item) => !item.total && item.key !== 'costOfRevenue')
          .map((item) => ({
            label: labels[item.key],
            value: item.value,
            color: getWaterfallColor(item.key, item.total, item.value),
          })),
      });
    }
    return {
      currency,
      simplified: waterfall.simplified,
      series: [],
      rows,
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
            isFinancialNumber(row.netMarginPercent)
              ? row.netMarginPercent
              : getNetMargin(row.revenue, row.netIncome),
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
    rows: getFinancialEarningsRows(
      data.earnings.items,
      data.period,
      currency,
    ).map((row) => ({
      key: row.date,
      label:
        data.period === 'quarter' && !row.fiscalPeriod
          ? row.date
          : getFinancialPeriodLabel(row),
      values: [row.actual, row.estimate],
    })),
  };
}
