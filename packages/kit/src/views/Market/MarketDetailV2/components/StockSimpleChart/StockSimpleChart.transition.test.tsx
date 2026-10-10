/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { StockSimpleChart, StockSimpleChartContent } from './StockSimpleChart';
import {
  buildStockSimpleChartAssetKey,
  buildStockSimpleChartScopeKey,
} from './stockSimpleChartData';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({
    children,
    testID,
  }: PropsWithChildren<{ testID?: string }>) => (
    <div data-testid={testID}>{children}</div>
  );
  return {
    Stack: Frame,
    YStack: Frame,
    SizableText: Frame,
    Button: Frame,
    Icon: () => null,
    Skeleton: () => null,
  };
});
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../hooks/useMarketKlineLivePrice', () => ({
  useMarketKlineLivePrice: () => undefined,
}));
const mockTokenDetail = jest.fn<
  { isNative?: boolean; networkId: string; tokenAddress: string },
  []
>();
jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => mockTokenDetail(),
}));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({}),
}));
const mockPromiseResult = jest.fn<
  { result: ReturnType<typeof result>; isLoading: boolean; run: () => void },
  []
>();
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => mockPromiseResult(),
}));
const mockChart = jest.fn<void, [{ data: IMarketTokenChart }]>();
jest.mock('@onekeyhq/kit/src/components/StockPriceLineChart', () => ({
  StockPriceLineChart: (props: { data: IMarketTokenChart }) => {
    mockChart(props);
    return <div data-testid="rendered-chart" />;
  },
}));

const base = {
  networkId: 'evm--1',
  tokenAddress: '0xabc',
  priceMode: 'token' as const,
  range: '1D' as const,
};
const points: IMarketTokenChart = [
  [1_800_000_000, 10],
  [1_800_000_300, 12],
];
function result(range: '1D' | '1W', data = points) {
  return {
    data,
    range,
    scopeKey: buildStockSimpleChartScopeKey({ ...base, range }),
    assetKey: buildStockSimpleChartAssetKey(base),
    status: 'success',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTokenDetail.mockReturnValue({
    isNative: false,
    networkId: base.networkId,
    tokenAddress: base.tokenAddress,
  });
  mockPromiseResult.mockReturnValue({
    result: result('1D'),
    isLoading: false,
    run: jest.fn(),
  });
});

it('renders the Swap asset independently of the Market detail identity', () => {
  mockTokenDetail.mockReturnValue({
    networkId: 'evm--56',
    tokenAddress: '0xdef',
  });
  render(<StockSimpleChartContent {...base} isNative={false} />);
  expect(mockTokenDetail).not.toHaveBeenCalled();
  expect(screen.getByTestId('rendered-chart')).toBeTruthy();
  expect(mockChart.mock.calls.at(-1)?.[0].data).toEqual(points);
});

it('hides the previous Swap range until the requested range completes', () => {
  const { rerender } = render(
    <StockSimpleChartContent {...base} isNative={false} />,
  );
  mockPromiseResult.mockReturnValue({
    result: result('1D'),
    isLoading: true,
    run: jest.fn(),
  });
  rerender(<StockSimpleChartContent {...base} isNative={false} range="1W" />);
  expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
  expect(screen.queryByTestId('rendered-chart')).toBeNull();
  mockPromiseResult.mockReturnValue({
    result: result('1W'),
    isLoading: false,
    run: jest.fn(),
  });
  rerender(<StockSimpleChartContent {...base} isNative={false} range="1W" />);
  expect(screen.getByTestId('rendered-chart')).toBeTruthy();
});

it('keeps the drawn series through consecutive range changes and replaces it on completion', () => {
  const { rerender } = render(
    <StockSimpleChart range="1D" priceMode="token" />,
  );
  mockPromiseResult.mockReturnValue({
    result: result('1D'),
    isLoading: true,
    run: jest.fn(),
  });
  for (const range of ['1W', '1M', '1Y'] as const) {
    rerender(<StockSimpleChart range={range} priceMode="token" />);
    expect(screen.queryByTestId('stock-simple-chart-loading')).toBeNull();
    expect(screen.getByTestId('rendered-chart')).toBeTruthy();
    expect(mockChart.mock.calls.at(-1)?.[0].data).toEqual(points);
  }
  const updated: IMarketTokenChart = [
    [1_800_000_000, 20],
    [1_800_000_300, 22],
  ];
  mockPromiseResult.mockReturnValue({
    result: result('1W', updated),
    isLoading: false,
    run: jest.fn(),
  });
  rerender(<StockSimpleChart range="1W" priceMode="token" />);
  expect(mockChart.mock.calls.at(-1)?.[0].data).toEqual(updated);
});

it.each(['token', 'network', 'price source', 'upstream id'])(
  'hides the previous series when changing %s',
  (change) => {
    const { rerender } = render(
      <StockSimpleChart range="1D" priceMode="token" />,
    );
    if (change === 'token')
      mockTokenDetail.mockReturnValue({
        networkId: base.networkId,
        tokenAddress: '0xdef',
      });
    if (change === 'network')
      mockTokenDetail.mockReturnValue({
        networkId: 'evm--56',
        tokenAddress: base.tokenAddress,
      });
    rerender(
      <StockSimpleChart
        range="1W"
        priceMode={change === 'price source' ? 'share' : 'token'}
        marketAssetId={change === 'upstream id' ? 'bitcoin' : undefined}
      />,
    );
    expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
    expect(screen.queryByTestId('rendered-chart')).toBeNull();
  },
);

it('keeps the initial loading state and shows a failed range request instead of stale data', () => {
  mockPromiseResult.mockReturnValue({
    result: { ...result('1D', []), status: 'pending' },
    isLoading: true,
    run: jest.fn(),
  });
  const { rerender } = render(
    <StockSimpleChart range="1D" priceMode="token" />,
  );
  expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
  mockPromiseResult.mockReturnValue({
    result: { ...result('1W', []), status: 'error' },
    isLoading: false,
    run: jest.fn(),
  });
  rerender(<StockSimpleChart range="1W" priceMode="token" />);
  expect(screen.getByTestId('stock-simple-chart-error')).toBeTruthy();
  expect(screen.queryByTestId('rendered-chart')).toBeNull();
});
