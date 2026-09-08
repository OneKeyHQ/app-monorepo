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
    Button,
    useTheme: () => ({
      textSubdued: { val: '#777' },
      borderSubdued: { val: '#eee' },
      bgApp: { val: '#fff' },
    }),
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

it('hides low-consensus annual estimates without discarding quarterly estimates', () => {
  expect(
    buildFinancialChart(annual, 'earnings', labels).rows[0].values,
  ).toEqual([2, null]);
  expect(
    buildFinancialChart(quarterly, 'earnings', labels).rows[0].values,
  ).toEqual([2, 3]);
});

it('shows exact hover values and missing fields without converting them to zero', () => {
  const chart = buildFinancialChart(annual, 'debt', labels);
  render(
    <IntlProvider locale="en" messages={intlMessages}>
      <FinancialChart rows={chart.rows} series={chart.series} testID="chart" />
    </IntlProvider>,
  );
  fireEvent.mouseEnter(screen.getByTestId('chart-point-0'));
  const tooltip = screen.getByTestId('chart-tooltip');
  expect(tooltip.textContent).toContain('Free cash flow -10');
  expect(tooltip.textContent).toContain('Cash & equivalents --');
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
