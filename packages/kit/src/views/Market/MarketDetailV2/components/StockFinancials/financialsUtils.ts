// cspell:ignore financials
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IStockFinancialConversion,
  IStockFinancialEarning,
  IStockFinancialPeriod,
  IStockFinancialReportingPeriod,
  IStockFinancials,
} from '@onekeyhq/shared/types/marketStockFinancials';

export function isFinancialNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function matchesFinancialPeriod(
  row: IStockFinancialReportingPeriod,
  period: IStockFinancialPeriod,
) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    /^\d{4}$/.test(row.fiscalYear) &&
    (period === 'quarter'
      ? /^Q[1-4]$/.test(row.fiscalPeriod ?? '')
      : !row.fiscalPeriod || row.fiscalPeriod === 'FY')
  );
}

export function getFinancialRows<T extends IStockFinancialReportingPeriod>(
  rows: T[],
  period: IStockFinancialPeriod,
  currency?: string,
): T[] {
  // The aggregation endpoint already sorts ascending. Sort a copy defensively
  // and keep fiscal labels from the source instead of deriving calendar years.
  return rows
    .filter(
      (row) =>
        matchesFinancialPeriod(row, period) &&
        (!currency ||
          !row.reportedCurrency ||
          row.reportedCurrency === currency),
    )
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(-5);
}

export function getFinancialPeriodLabel(row: IStockFinancialReportingPeriod) {
  return /^Q[1-4]$/.test(row.fiscalPeriod ?? '')
    ? `${row.fiscalPeriod} '${row.fiscalYear.slice(-2)}`
    : `FY${row.fiscalYear}`;
}

export function getFinancialEarningsRows(
  rows: IStockFinancialEarning[],
  period: IStockFinancialPeriod,
  currency?: string,
) {
  const reportedRows = getFinancialRows(rows, period, currency);
  if (period !== 'quarter') return reportedRows;
  // Analyst forecasts carry a date but may omit the fiscal quarter. Keep
  // those forecasts without treating their calendar date as a fiscal label.
  const forecasts = rows.filter(
    (row) =>
      !row.fiscalPeriod &&
      row.actual === null &&
      isFinancialNumber(row.estimate) &&
      matchesFinancialPeriod(row, 'annual') &&
      (!currency || !row.reportedCurrency || row.reportedCurrency === currency),
  );
  return [...reportedRows, ...forecasts]
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(-5);
}

export function getNetMargin(revenue: number | null, netIncome: number | null) {
  return isFinancialNumber(revenue) &&
    revenue !== 0 &&
    isFinancialNumber(netIncome)
    ? (netIncome / revenue) * 100
    : null;
}

export type IFinancialWaterfallKey =
  | 'revenue'
  | 'costOfRevenue'
  | 'grossProfit'
  | 'operatingExpenses'
  | 'operatingIncome'
  | 'nonOperatingIncomeExpenses'
  | 'incomeBeforeTax'
  | 'incomeTaxExpense'
  | 'netIncome';

export type IFinancialWaterfallBar = {
  key: IFinancialWaterfallKey;
  start: number;
  end: number;
  value: number;
  total: boolean;
};

function amountsEqual(left: number, right: number) {
  // Allow floating-point noise, not a material residual from different accounts.
  return Math.abs(left - right) <= Math.max(1, Math.abs(right) * 1e-8);
}

export function buildFinancialWaterfall(row: IStockFinancialConversion) {
  const {
    revenue,
    costOfRevenue,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    nonOperatingIncomeExpenses,
    incomeTaxExpense,
    netIncome,
  } = row;
  const bars: IFinancialWaterfallBar[] = [];
  const total = (key: IFinancialWaterfallKey, value: number | null) => {
    if (isFinancialNumber(value)) {
      bars.push({ key, start: 0, end: value, value, total: true });
    }
  };
  const delta = (key: IFinancialWaterfallKey, start: number, value: number) => {
    bars.push({ key, start, end: start + value, value, total: false });
  };
  if (
    isFinancialNumber(revenue) &&
    isFinancialNumber(costOfRevenue) &&
    isFinancialNumber(grossProfit) &&
    isFinancialNumber(operatingExpenses) &&
    isFinancialNumber(operatingIncome) &&
    isFinancialNumber(nonOperatingIncomeExpenses) &&
    isFinancialNumber(incomeTaxExpense) &&
    isFinancialNumber(netIncome) &&
    amountsEqual(revenue - costOfRevenue, grossProfit) &&
    amountsEqual(grossProfit - operatingExpenses, operatingIncome) &&
    amountsEqual(
      operatingIncome + nonOperatingIncomeExpenses - incomeTaxExpense,
      netIncome,
    )
  ) {
    total('revenue', revenue);
    delta('costOfRevenue', revenue, -costOfRevenue);
    total('grossProfit', grossProfit);
    delta('operatingExpenses', grossProfit, -operatingExpenses);
    total('operatingIncome', operatingIncome);
    delta(
      'nonOperatingIncomeExpenses',
      operatingIncome,
      nonOperatingIncomeExpenses,
    );
    delta(
      'incomeTaxExpense',
      operatingIncome + nonOperatingIncomeExpenses,
      -incomeTaxExpense,
    );
    total('netIncome', netIncome);
    return { bars, simplified: false };
  }
  // Do not disguise mismatched accounts by using the API's taxesAndOther
  // residual as tax. The endpoint omits pre-tax income; net income plus tax
  // reconstructs that subtotal only when both source values are present.
  total('revenue', revenue);
  total('grossProfit', grossProfit);
  total('operatingIncome', operatingIncome);
  total(
    'incomeBeforeTax',
    isFinancialNumber(netIncome) && isFinancialNumber(incomeTaxExpense)
      ? netIncome + incomeTaxExpense
      : null,
  );
  total('netIncome', netIncome);
  return { bars, simplified: true };
}

export function getFinancialDomain(values: (number | null)[]) {
  const finiteValues = values.filter(isFinancialNumber);
  const min = Math.min(0, ...finiteValues);
  const max = Math.max(0, ...finiteValues);
  const span = max - min || 1;
  return { min: min < 0 ? min - span * 0.1 : 0, max: max + span * 0.1 };
}

// Domains always contain four equal intervals, matching the five rendered ticks.
function getFinancialTickStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const multiplier =
    [1, 2, 2.5, 4, 5, 10].find((candidate) => candidate * magnitude >= value) ??
    10;
  return magnitude * multiplier;
}

export function getFinancialPerformanceDomain(values: (number | null)[]) {
  const numbers = values.filter(isFinancialNumber);
  // Keep the existing padded scale for very small datasets. With one or two
  // points, a rounded four-step scale can make the top tick less useful than
  // the original 10% breathing room.
  if (numbers.length <= 2) return getFinancialDomain(values);
  const min = Math.min(0, ...numbers);
  const max = Math.max(0, ...numbers);
  let step = getFinancialTickStep((max - min || 1) / 4);
  let lower = Math.floor(min / step) * step;
  while (lower + step * 4 < max) {
    step = getFinancialTickStep(step * 1.01);
    lower = Math.floor(min / step) * step;
  }
  return { min: lower, max: lower + step * 4 };
}

export function getFinancialPercentDomain(values: (number | null)[]) {
  const numbers = values.filter(isFinancialNumber);
  if (!numbers.length) return { min: -1, max: 1 };
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  // Give percentage changes breathing room rather than stretching their
  // observed minimum and maximum across the full height of the bar chart.
  const step = getFinancialTickStep(Math.max(2, (max - min) * 2) / 4);
  const upper = Math.ceil((max === min ? max + step : max) / step) * step;
  return { min: upper - step * 4, max: upper };
}

type IFinancialFetcher = (params: {
  stockId: string;
  period: IStockFinancialPeriod;
}) => Promise<IStockFinancials | null>;

export function createFinancialsLoader(fetcher: IFinancialFetcher) {
  const cache = new Map<
    string,
    { data: IStockFinancials | null; expiresAt: number }
  >();
  const pending = new Map<string, Promise<IStockFinancials | null>>();
  return async (
    stockId: string,
    period: IStockFinancialPeriod,
    refresh = false,
  ) => {
    const normalizedStockId = stockId.trim().toUpperCase();
    const key = `${normalizedStockId}:${period}`;
    const cached = cache.get(key);
    if (!refresh && cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const request = fetcher({ stockId: normalizedStockId, period }).then(
      (data) => {
        if (
          data &&
          (data.stockId.toUpperCase() !== normalizedStockId ||
            data.period !== period)
        ) {
          throw new OneKeyLocalError(
            'Stock financials response identity mismatch',
          );
        }
        const firstKey = cache.keys().next().value;
        if (cache.size >= 20 && firstKey !== undefined) cache.delete(firstKey);
        cache.set(key, {
          data,
          expiresAt:
            Date.now() + (data && !data.partial ? 15 * 60_000 : 30_000),
        });
        return data;
      },
    );
    pending.set(key, request);
    try {
      return await request;
    } finally {
      pending.delete(key);
    }
  };
}
