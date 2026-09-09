// cspell:ignore financials
import type {
  IStockFinancialConversion,
  IStockFinancials,
} from '@onekeyhq/shared/types/marketStockFinancials';

import {
  buildFinancialWaterfall,
  createFinancialsLoader,
  getFinancialDomain,
  getFinancialPercentDomain,
  getFinancialPeriodLabel,
  getFinancialRows,
  getNetMargin,
} from './financialsUtils';

const conversion: IStockFinancialConversion = {
  date: '2025-09-27',
  fiscalYear: '2025',
  fiscalPeriod: 'FY',
  reportedCurrency: 'USD',
  revenue: 416_161,
  costOfRevenue: 220_960,
  grossProfit: 195_201,
  operatingExpenses: 62_151,
  operatingIncome: 133_050,
  nonOperatingIncomeExpenses: -321,
  incomeTaxExpense: 20_719,
  taxesAndOther: -20_719,
  netIncome: 112_010,
};

const financials: IStockFinancials = {
  stockId: 'AAPL',
  period: 'annual',
  currency: 'USD',
  performance: [],
  revenueToProfitConversion: conversion,
  debtLevelAndCoverage: [],
  earnings: { items: [] },
  partial: false,
  unavailableSources: [],
  updatedAt: '2026-09-07T00:00:00Z',
};

describe('stock financial chart data', () => {
  it('keeps ascending fiscal periods without mutating or duplicating Q labels', () => {
    const rows = [
      { date: '2026-03-28', fiscalYear: '2026', fiscalPeriod: 'Q2' },
      { date: '2025-12-27', fiscalYear: '2026', fiscalPeriod: 'Q1' },
      { date: '2025-09-27', fiscalYear: '2025', fiscalPeriod: 'FY' },
    ];
    const actual = getFinancialRows(rows, 'quarter');
    expect(actual.map(getFinancialPeriodLabel)).toEqual(["Q1 '26", "Q2 '26"]);
    expect(rows[0].fiscalPeriod).toBe('Q2');
    expect(getFinancialPeriodLabel(rows[2])).toBe('FY2025');
  });

  it('does not mix report currencies or turn null and zero revenue into margins', () => {
    expect(
      getFinancialRows(
        [{ ...conversion, reportedCurrency: 'EUR' }],
        'annual',
        'USD',
      ),
    ).toEqual([]);
    expect(getNetMargin(0, 10)).toBeNull();
    expect(getNetMargin(100, null)).toBeNull();
    expect(getNetMargin(100, 0)).toBe(0);
    expect(getNetMargin(100, -20)).toBe(-20);
  });

  it('reproduces the eight-step AAPL waterfall from the work order', () => {
    const result = buildFinancialWaterfall(conversion);
    expect(result.simplified).toBe(false);
    expect(result.bars.map(({ start, end }) => [start, end])).toEqual([
      [0, 416_161],
      [416_161, 195_201],
      [0, 195_201],
      [195_201, 133_050],
      [0, 133_050],
      [133_050, 132_729],
      [132_729, 112_010],
      [0, 112_010],
    ]);
  });

  it('uses simplified subtotals for non-closing accounts instead of a tax residual', () => {
    const result = buildFinancialWaterfall({
      ...conversion,
      netIncome: 100_000,
      taxesAndOther: -32_729,
    });
    expect(result.simplified).toBe(true);
    expect(result.bars.map(({ key }) => key)).toEqual([
      'revenue',
      'grossProfit',
      'operatingIncome',
      'incomeBeforeTax',
      'netIncome',
    ]);
    expect(result.bars[3].value).toBe(120_719);
  });

  it('omits missing subtotals and preserves losses and zero', () => {
    const result = buildFinancialWaterfall({
      ...conversion,
      grossProfit: null,
      netIncome: -100,
      operatingIncome: 0,
    });
    expect(result.bars.some(({ key }) => key === 'grossProfit')).toBe(false);
    expect(result.bars.find(({ key }) => key === 'netIncome')?.value).toBe(
      -100,
    );
    expect(
      result.bars.find(({ key }) => key === 'operatingIncome')?.value,
    ).toBe(0);
    expect(getFinancialDomain([null, -100, 200])).toEqual({
      min: -130,
      max: 230,
    });
    expect(getFinancialDomain([null, 0]).max).toBeGreaterThan(0);
  });

  it('keeps zero and constant percentage axes readable', () => {
    expect(getFinancialPercentDomain([0, null])).toEqual({
      min: -1.2,
      max: 1.2,
    });
    expect(getFinancialPercentDomain([25, 25])).toEqual({
      min: 23.8,
      max: 26.2,
    });
  });
});

describe('stock financial request cache', () => {
  it('deduplicates concurrent requests and separates symbols and periods', async () => {
    const fetcher = jest.fn(async ({ stockId, period }) => ({
      ...financials,
      stockId,
      period,
    }));
    const load = createFinancialsLoader(fetcher);
    await Promise.all([load('aapl', 'annual'), load('AAPL', 'annual')]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await load('AAPL', 'quarter');
    await load('NVDA', 'annual');
    expect(fetcher).toHaveBeenCalledTimes(3);
    await load('AAPL', 'annual', true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('rejects mismatched responses and does not cache failed requests', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ ...financials, stockId: 'NVDA' })
      .mockResolvedValue(financials);
    const load = createFinancialsLoader(fetcher);
    await expect(load('AAPL', 'annual')).rejects.toThrow('identity mismatch');
    await expect(load('AAPL', 'annual')).resolves.toEqual(financials);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries partial data earlier than complete data', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const fetcher = jest
        .fn()
        .mockResolvedValue({ ...financials, partial: true });
      const load = createFinancialsLoader(fetcher);
      await load('AAPL', 'annual');
      now.mockReturnValue(31_000);
      await load('AAPL', 'annual');
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
});
