/** @jest-environment jsdom */
// cspell:ignore financials
import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import messages from '@onekeyhq/shared/src/locale/json/en_US.json';
import type { IStockFinancials } from '@onekeyhq/shared/types/marketStockFinancials';

import { StockTokenOverview } from '../TokenOverview/StockTokenOverview';

import { FinancialChart } from './FinancialChart';
import { buildFinancialChart } from './financialChartData';
import { StockFinancials } from './StockFinancials';

import type { IStockFinancialLabels } from './financialChartData';

const intlMessages: Record<string, string> = messages;

const labels: IStockFinancialLabels = {
  financials: 'Financials',
  annual: 'Annual',
  quarter: 'Quarterly',
  performance: 'Performance',
  conversion: 'Revenue to profit conversion',
  debt: 'Debt level and coverage',
  earnings: 'Earnings',
  revenue: 'Revenue',
  costOfRevenue: 'COGS',
  grossProfit: 'Gross profit',
  operatingExpenses: 'Op expenses',
  operatingIncome: 'Op income',
  nonOperatingIncomeExpenses: 'Non-Op income/expenses',
  incomeBeforeTax: 'Pre-tax income',
  incomeTaxExpense: 'Taxes',
  netIncome: 'Net income',
  netMargin: 'Net margin %',
  totalDebt: 'Debt',
  freeCashFlow: 'Free cash flow',
  cashAndCashEquivalents: 'Cash & equivalents',
  actual: 'Actual',
  estimate: 'Estimate',
  partial: 'Some financial data is unavailable.',
  simplified: 'Simplified subtotals',
  next: 'Next',
  expensesAndAdjustments: 'Expenses & adjustments',
};

const annual: IStockFinancials = {
  stockId: 'AAPL',
  period: 'annual',
  currency: 'USD',
  partial: false,
  unavailableSources: [],
  updatedAt: '2026-09-07T00:00:00Z',
  performance: [
    {
      date: '2025-09-27',
      fiscalYear: '2025',
      fiscalPeriod: 'FY',
      revenue: 1000,
      netIncome: 200,
      netMarginPercent: 20,
    },
  ],
  debtLevelAndCoverage: [
    {
      date: '2025-09-27',
      fiscalYear: '2025',
      fiscalPeriod: 'FY',
      totalDebt: 50,
      freeCashFlow: -10,
      cashAndCashEquivalents: null,
    },
  ],
  earnings: {
    items: [
      {
        date: '2025-09-27',
        fiscalYear: '2025',
        fiscalPeriod: 'FY',
        actual: 2,
        estimate: 3,
        estimateLow: 2,
        estimateHigh: 4,
        numAnalysts: 2,
      },
    ],
  },
};
const quarterly: IStockFinancials = {
  ...annual,
  period: 'quarter',
  performance: [
    {
      ...annual.performance[0],
      date: '2026-03-28',
      fiscalYear: '2026',
      fiscalPeriod: 'Q2',
      revenue: 250,
      netIncome: 0,
    },
  ],
  debtLevelAndCoverage: [
    { ...annual.debtLevelAndCoverage[0], fiscalPeriod: 'Q1' },
  ],
  earnings: {
    items: [
      { ...annual.earnings.items[0], fiscalPeriod: 'Q1', numAnalysts: null },
    ],
  },
};
const conversion = {
  date: '2025-09-27',
  fiscalYear: '2025',
  fiscalPeriod: 'FY',
  revenue: 1000,
  costOfRevenue: 600,
  grossProfit: 400,
  operatingExpenses: 150,
  operatingIncome: 250,
  nonOperatingIncomeExpenses: -20,
  incomeTaxExpense: 50,
  taxesAndOther: -50,
  netIncome: 180,
};
const mockRetry = jest.fn();
let mockResult: {
  stockId: string;
  annual: { data: IStockFinancials | null; failed: boolean };
  quarter: { data: IStockFinancials | null; failed: boolean };
} = {
  stockId: 'AAPL',
  annual: { data: annual, failed: false },
  quarter: { data: quarterly, failed: false },
};

jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: () => '--' }),
}));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({ stockId: 'AAPL', stockDetail: { symbol: 'AAPL' } }),
}));
jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    isStockToken: true,
    tokenDetail: { symbol: 'AAPLon' },
  }),
}));
jest.mock('../../hooks/useStockSecurityStats', () => ({
  useStockSecurityStats: () => ({
    assetAnalysisRows: [],
    tradingActivityRows: [],
    descriptionRows: [],
  }),
}));
jest.mock('../../utils/stockPublicDataUtils', () => ({
  buildStockInfoFromPublicDetail: () => ({}),
  formatDirectPercentValue: () => '--',
  formatStockAnalystConsensus: () => '--',
}));
jest.mock('../StockDescriptionRows', () => ({
  StockDescriptionRows: () => null,
}));
jest.mock('../StockStatSections', () => ({ StockStatSections: () => null }));

jest.mock('./useStockFinancials', () => ({
  useStockFinancials: () => ({
    result: mockResult,
    isLoading: false,
    retry: mockRetry,
  }),
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'svg',
  G: 'g',
  Circle: 'circle',
  Line: 'line',
  Path: 'path',
  Rect: 'rect',
  Text: 'text',
}));
jest.mock('@onekeyhq/components', () => {
  type IProps = {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    onHoverIn?: () => void;
    onHoverOut?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    'aria-pressed'?: boolean;
    'aria-label'?: string;
  };
  const Stack = (props: IProps) => (
    <div
      data-testid={props.testID}
      onMouseEnter={props.onHoverIn}
      onMouseLeave={props.onHoverOut}
      onClick={props.onPress}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') props.onPress?.();
      }}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      aria-label={props['aria-label']}
    >
      {props.children}
    </div>
  );
  const Button = (props: IProps) => (
    <button
      type="button"
      data-testid={props.testID}
      onClick={props.onPress}
      aria-pressed={props['aria-pressed']}
    >
      {props.children}
    </button>
  );
  return {
    Stack,
    Divider: Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Skeleton: Stack,
    Theme: Stack,
    Button,
    getTokenValue: (token: string, category: string) =>
      category === 'radius' ? 4 : 32,
    useTheme: () => ({
      textSubdued: { val: '#777' },
      borderSubdued: { val: '#eee' },
      bgApp: { val: '#fff' },
      bg: { val: '#fff' },
      bgInverse: { val: '#222' },
      text: { val: '#111' },
      textInverse: { val: '#fff' },
      bgHover: { val: '#eee' },
      neutral3: { val: '#eee' },
      blue9: { val: '#0090ff' },
      orange9: { val: '#f76b15' },
      teal9: { val: '#12a594' },
      red9: { val: '#e5484d' },
    }),
    useThemeName: () => 'light',
  };
});

function renderFinancials() {
  return render(
    <IntlProvider locale="en" messages={intlMessages}>
      <StockFinancials stockId="AAPL" labels={labels} />
    </IntlProvider>,
  );
}

beforeEach(() => {
  mockResult = {
    stockId: 'AAPL',
    annual: { data: annual, failed: false },
    quarter: { data: quarterly, failed: false },
  };
  mockRetry.mockClear();
});

it('uses the bundled financial translations when labels are not overridden', () => {
  render(
    <IntlProvider locale="en" messages={intlMessages}>
      <StockFinancials stockId="AAPL" />
    </IntlProvider>,
  );
  expect(
    screen.getByText(
      intlMessages[ETranslations.market_stock_financials__title],
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      intlMessages[
        ETranslations.market_stock_financials_revenue_to_profit__title
      ],
    ),
  ).toBeTruthy();
});

it('switches each chart independently and displays fiscal quarter data', () => {
  renderFinancials();
  fireEvent.click(screen.getByTestId('stock-financials-performance-quarter'));
  expect(
    screen
      .getByTestId('stock-financials-performance-quarter')
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    screen
      .getByTestId('stock-financials-debt-annual')
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    within(screen.getByTestId('stock-financials-performance-chart')).getByText(
      "Q2 '26",
    ),
  ).toBeTruthy();
});

it('hides the quarterly control when the server sends FY rows for quarter', () => {
  mockResult.quarter.data = { ...annual, period: 'quarter' };
  renderFinancials();
  expect(
    screen.queryByTestId('stock-financials-performance-quarter'),
  ).toBeNull();
  expect(screen.getByTestId('stock-financials-performance-chart')).toBeTruthy();
});

it('preserves useful charts and exposes retry for partial source failure', () => {
  mockResult.annual.data = {
    ...annual,
    partial: true,
    unavailableSources: ['cash_flow_statement'],
  };
  renderFinancials();
  expect(screen.getByTestId('stock-financials-performance-chart')).toBeTruthy();
  fireEvent.click(screen.getByTestId('stock-financials-performance-retry'));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});

it('preserves annual and quarterly estimates regardless of analyst counts', () => {
  expect(
    buildFinancialChart(annual, 'earnings', labels).rows[0].values,
  ).toEqual([2, 3]);
  expect(
    buildFinancialChart(quarterly, 'earnings', labels).rows[0].values,
  ).toEqual([2, 3]);
});

it.each([null, 0, 1, 2, 3])(
  'renders annual Estimate with %s analysts',
  (numAnalysts) => {
    mockResult.annual.data = {
      ...annual,
      earnings: {
        items: [{ ...annual.earnings.items[0], numAnalysts }],
      },
    };
    renderFinancials();
    const chart = screen.getByTestId('stock-financials-earnings-chart');
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    fireEvent.mouseEnter(
      screen.getByTestId('stock-financials-earnings-chart-point-0'),
    );
    expect(
      screen.getByTestId('stock-financials-earnings-chart-tooltip').textContent,
    ).toContain('Estimate 3');
  },
);

it('leaves absent estimates empty instead of inventing a zero comparison', () => {
  mockResult.annual.data = {
    ...annual,
    earnings: {
      items: [{ ...annual.earnings.items[0], estimate: null }],
    },
  };
  renderFinancials();
  expect(
    screen
      .getByTestId('stock-financials-earnings-chart')
      .querySelectorAll('circle'),
  ).toHaveLength(1);
  fireEvent.mouseEnter(
    screen.getByTestId('stock-financials-earnings-chart-point-0'),
  );
  expect(
    screen.getByTestId('stock-financials-earnings-chart-tooltip').textContent,
  ).toContain('Estimate --');
});

it('renders dated quarterly forecasts when the API omits the fiscal period', () => {
  mockResult.quarter.data = {
    ...quarterly,
    earnings: {
      items: [
        { ...quarterly.earnings.items[0], estimate: null },
        {
          ...quarterly.earnings.items[0],
          date: '2026-09-30',
          fiscalYear: '2026',
          fiscalPeriod: undefined,
          actual: null,
          estimate: 1.98,
        },
      ],
    },
  };
  renderFinancials();
  fireEvent.click(screen.getByTestId('stock-financials-earnings-quarter'));
  const chart = screen.getByTestId('stock-financials-earnings-chart');
  expect(chart.querySelectorAll('circle')).toHaveLength(2);
  expect(chart.querySelector('circle[fill="#fff"]')).toBeTruthy();
  fireEvent.mouseEnter(
    screen.getByTestId('stock-financials-earnings-chart-point-1'),
  );
  expect(chart.querySelector('svg')?.textContent).toContain('2026-09-30');
  const tooltip = screen.getByTestId('stock-financials-earnings-chart-tooltip');
  expect(tooltip.textContent).toContain('Actual --');
  expect(tooltip.textContent).toContain('Estimate 1.98');
});

it('uses the same compact amount units for axes and hover values in every locale', () => {
  const chart = buildFinancialChart(
    {
      ...annual,
      performance: [
        {
          ...annual.performance[0],
          revenue: 100_000_000_000,
          netIncome: 20_000_000_000,
        },
      ],
    },
    'performance',
    labels,
  );
  render(
    <IntlProvider locale="zh-CN" messages={intlMessages}>
      <FinancialChart rows={chart.rows} series={chart.series} testID="chart" />
    </IntlProvider>,
  );
  expect(
    screen.getByTestId('chart').querySelector('svg')?.textContent,
  ).toContain('110B');
  fireEvent.mouseEnter(screen.getByTestId('chart-point-0'));
  expect(screen.getByTestId('chart-tooltip').textContent).toContain(
    'Revenue 100B',
  );
  expect(screen.getByTestId('chart-tooltip').textContent).toContain(
    'Net income 20B',
  );
  expect(screen.getByTestId('chart-tooltip').textContent).toContain(
    'Net margin % 20%',
  );
});

it('collapses a reconciled waterfall without losing its adjustments or endpoints', () => {
  const data = { ...annual, revenueToProfitConversion: conversion };
  const detailed = buildFinancialChart(data, 'conversion', labels);
  const compact = buildFinancialChart(data, 'conversion', labels, true);
  expect(detailed.rows).toHaveLength(8);
  expect(compact.rows.map((row) => row.key)).toEqual([
    'revenue',
    'costOfRevenue',
    'grossProfit',
    'expensesAndAdjustments',
    'netIncome',
  ]);
  expect(compact.rows[3].range).toMatchObject({
    start: 400,
    end: 180,
    connect: true,
  });
  expect(compact.rows[3].values).toEqual([-220]);
  expect(compact.rows[3].details?.map((item) => item.value)).toEqual([
    -150, -20, -50,
  ]);
  expect(compact.rows[4]).toEqual(detailed.rows[7]);
  render(
    <IntlProvider locale="en" messages={intlMessages}>
      <FinancialChart
        rows={compact.rows}
        series={compact.series}
        currency="USD"
        testID="compact"
      />
    </IntlProvider>,
  );
  fireEvent.mouseEnter(screen.getByTestId('compact-point-3'));
  const tooltip = screen.getByTestId('compact-tooltip');
  expect(tooltip.textContent).toContain('Expenses & adjustments -220 USD');
  expect(tooltip.textContent).toContain('Op expenses -150 USD');
  expect(tooltip.textContent).toContain('Non-Op income/expenses -20 USD');
  expect(tooltip.textContent).toContain('Taxes -50 USD');
});

it('keeps missing or unreconciled conversion data in the simplified subtotal chart', () => {
  for (const fields of [{ incomeTaxExpense: null }, { netIncome: 160 }]) {
    const chart = buildFinancialChart(
      {
        ...annual,
        revenueToProfitConversion: { ...conversion, ...fields },
      },
      'conversion',
      labels,
      true,
    );
    expect(chart.simplified).toBe(true);
    expect(chart.rows.some((row) => row.key === 'expensesAndAdjustments')).toBe(
      false,
    );
    expect(chart.rows.every((row) => row.range?.connect === false)).toBe(true);
  }
});

it('preserves positive adjustments and losses when collapsing the waterfall', () => {
  for (const fields of [
    { nonOperatingIncomeExpenses: 250, netIncome: 450, expected: 50 },
    {
      operatingExpenses: 450,
      operatingIncome: -50,
      netIncome: -120,
      expected: -520,
    },
  ]) {
    const chart = buildFinancialChart(
      {
        ...annual,
        revenueToProfitConversion: { ...conversion, ...fields },
      },
      'conversion',
      labels,
      true,
    );
    const row = chart.rows[3];
    expect(chart.simplified).toBe(false);
    expect(row.values).toEqual([fields.expected]);
    expect(row.details?.reduce((total, item) => total + item.value, 0)).toBe(
      fields.expected,
    );
    expect(row.range?.end).toBe(fields.netIncome);
  }
});

it('shows hover values and missing fields without converting them to zero', () => {
  const chart = buildFinancialChart(annual, 'debt', labels);
  render(
    <IntlProvider locale="en" messages={intlMessages}>
      <FinancialChart rows={chart.rows} series={chart.series} testID="chart" />
    </IntlProvider>,
  );
  expect(screen.queryByTestId('chart-tooltip')).toBeNull();
  fireEvent.mouseEnter(screen.getByTestId('chart-point-0'));
  const tooltip = screen.getByTestId('chart-tooltip');
  expect(tooltip.textContent).toContain('Free cash flow -10');
  expect(tooltip.textContent).toContain('Cash & equivalents --');
  fireEvent.mouseLeave(screen.getByTestId('chart-point-0'));
  expect(screen.queryByTestId('chart-tooltip')).toBeNull();
  fireEvent.focus(screen.getByTestId('chart-point-0'));
  fireEvent.click(screen.getByTestId('chart-point-0'));
  expect(screen.getByTestId('chart-tooltip')).toBeTruthy();
  fireEvent.click(screen.getByTestId('chart-point-0'));
  expect(screen.queryByTestId('chart-tooltip')).toBeNull();
});

it('mounts the financial charts in the mobile stock overview', () => {
  render(
    <IntlProvider locale="en" messages={intlMessages}>
      <StockTokenOverview />
    </IntlProvider>,
  );
  expect(screen.getByTestId('stock-financials')).toBeTruthy();
  expect(screen.getByTestId('stock-financials-performance-chart')).toBeTruthy();
  fireEvent.click(screen.getByTestId('stock-financials-performance-quarter'));
  expect(
    screen
      .getByTestId('stock-financials-performance-quarter')
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

it('distinguishes failed requests from successful empty responses', () => {
  mockResult = {
    stockId: 'AAPL',
    annual: { data: null, failed: true },
    quarter: { data: null, failed: true },
  };
  const view = renderFinancials();
  expect(
    within(screen.getByTestId('stock-financials-performance')).getByText(
      intlMessages[ETranslations.global_unknown_error_retry_message],
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId('stock-financials-performance-retry'));
  expect(mockRetry).toHaveBeenCalledTimes(1);
  view.unmount();
  mockResult = {
    stockId: 'AAPL',
    annual: { data: null, failed: false },
    quarter: { data: null, failed: false },
  };
  renderFinancials();
  expect(
    within(screen.getByTestId('stock-financials-performance')).getByText(
      intlMessages[ETranslations.global_no_data],
    ),
  ).toBeTruthy();
});

it('prefers valid API net margins and only computes missing margins', () => {
  const chart = (
    netMarginPercent: number | null,
    revenue: number | null = 1000,
  ) =>
    buildFinancialChart(
      {
        ...annual,
        performance: [{ ...annual.performance[0], revenue, netMarginPercent }],
      },
      'performance',
      labels,
    );
  expect(chart(17).rows[0].values[2]).toBe(17);
  expect(chart(0, null).rows[0].values[2]).toBe(0);
  expect(chart(null).rows[0].values[2]).toBe(20);
  expect(chart(NaN).rows[0].values[2]).toBe(20);
  expect(chart(null, null).rows[0].values[2]).toBeNull();
});
