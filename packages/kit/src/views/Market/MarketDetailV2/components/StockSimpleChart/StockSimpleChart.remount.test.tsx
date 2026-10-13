/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { StockSimpleChartContent } from './StockSimpleChart';
import { fetchStockSimpleChartPoints } from './stockSimpleChartData';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const deferredModule = jest.requireActual(
    '../../../../../../../components/src/hooks/useDeferredPromise',
  ) as typeof import('@onekeyhq/components/src/hooks/useDeferredPromise');
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
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredModule.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../hooks/useMarketKlineLivePrice', () => ({
  useMarketKlineLivePrice: () => undefined,
}));
jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({}),
}));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({}),
}));
jest.mock('./stockSimpleChartData', () => ({
  ...jest.requireActual<typeof import('./stockSimpleChartData')>(
    './stockSimpleChartData',
  ),
  fetchStockSimpleChartPoints: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/components/StockPriceLineChart', () => ({
  StockPriceLineChart: ({ data }: { data: IMarketTokenChart }) => (
    <div data-testid="drawn-series">{JSON.stringify(data)}</div>
  ),
}));

const mockFetchPoints = jest.mocked(fetchStockSimpleChartPoints);
const base = {
  retainOnRemount: true,
  networkId: '',
  tokenAddress: '',
  isNative: false,
  priceMode: 'share' as const,
  range: '1D' as const,
};
const points: IMarketTokenChart = [
  [1_800_000_000, 10],
  [1_800_000_300, 12],
];

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockFetchPoints.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('replays a loaded series on remount while a slow refresh is pending', async () => {
  let now = 1_800_000_600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockFetchPoints.mockResolvedValueOnce(points);
  const first = render(<StockSimpleChartContent {...base} stockId="REMOUNT" />);
  expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId('drawn-series')).toBeTruthy());
  first.unmount();

  now += 61_000;
  const refresh = deferred<IMarketTokenChart>();
  mockFetchPoints.mockReturnValueOnce(refresh.promise);
  render(<StockSimpleChartContent {...base} stockId="REMOUNT" />);
  expect(screen.queryByTestId('stock-simple-chart-loading')).toBeNull();
  expect(screen.getByTestId('drawn-series').textContent).toBe(
    JSON.stringify(points),
  );
  await waitFor(() => expect(mockFetchPoints).toHaveBeenCalledTimes(2));
  expect(screen.queryByTestId('stock-simple-chart-loading')).toBeNull();

  const updated: IMarketTokenChart = [
    [1_800_000_000, 20],
    [1_800_000_300, 22],
  ];
  await act(async () => refresh.resolve(updated));
  expect(screen.getByTestId('drawn-series').textContent).toBe(
    JSON.stringify(updated),
  );
});

it.each(['stock', 'range', 'price mode'])(
  'does not replay another %s when remounting',
  async (change) => {
    const stockId = `SCOPE-${change}`;
    mockFetchPoints.mockResolvedValueOnce(points);
    const first = render(
      <StockSimpleChartContent {...base} stockId={stockId} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('drawn-series')).toBeTruthy(),
    );
    first.unmount();
    mockFetchPoints.mockReturnValueOnce(deferred<IMarketTokenChart>().promise);
    render(
      <StockSimpleChartContent
        {...base}
        stockId={change === 'stock' ? 'OTHER' : stockId}
        range={change === 'range' ? '1W' : '1D'}
        priceMode={change === 'price mode' ? 'token' : 'share'}
        networkId={change === 'price mode' ? 'evm--1' : ''}
        tokenAddress={change === 'price mode' ? '0xstock' : ''}
      />,
    );
    expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
    expect(screen.queryByTestId('drawn-series')).toBeNull();
  },
);

it('does not seed a revisit from a response that completed after unmount', async () => {
  const abandoned = deferred<IMarketTokenChart>();
  mockFetchPoints.mockReturnValueOnce(abandoned.promise);
  const first = render(
    <StockSimpleChartContent {...base} stockId="ABANDONED" />,
  );
  await waitFor(() => expect(mockFetchPoints).toHaveBeenCalledTimes(1));
  first.unmount();
  await act(async () => abandoned.resolve(points));

  mockFetchPoints.mockReturnValueOnce(deferred<IMarketTokenChart>().promise);
  render(<StockSimpleChartContent {...base} stockId="ABANDONED" />);
  expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
  expect(screen.queryByTestId('drawn-series')).toBeNull();
});

it('drops a previous series when a successful refresh reports no points', async () => {
  let now = 1_800_000_600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockFetchPoints.mockResolvedValueOnce(points);
  const first = render(<StockSimpleChartContent {...base} stockId="EMPTY" />);
  await waitFor(() => expect(screen.getByTestId('drawn-series')).toBeTruthy());
  first.unmount();

  now += 61_000;
  mockFetchPoints.mockResolvedValueOnce([]);
  const second = render(<StockSimpleChartContent {...base} stockId="EMPTY" />);
  await waitFor(() =>
    expect(screen.getByTestId('stock-simple-chart-empty')).toBeTruthy(),
  );
  second.unmount();

  mockFetchPoints.mockReturnValueOnce(deferred<IMarketTokenChart>().promise);
  render(<StockSimpleChartContent {...base} stockId="EMPTY" />);
  expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
});

it('does not restore an older series after a newer same-scope request reports no points', async () => {
  const older = deferred<IMarketTokenChart>();
  const newer = deferred<IMarketTokenChart>();
  mockFetchPoints
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  const first = render(
    <StockSimpleChartContent {...base} stockId="ORDERING" />,
  );
  await waitFor(() => expect(mockFetchPoints).toHaveBeenCalledTimes(1));
  const second = render(
    <StockSimpleChartContent {...base} stockId="ORDERING" />,
  );
  await waitFor(() => expect(mockFetchPoints).toHaveBeenCalledTimes(2));
  await act(async () => newer.resolve([]));
  await act(async () => older.resolve(points));
  first.unmount();
  second.unmount();

  mockFetchPoints.mockReturnValueOnce(deferred<IMarketTokenChart>().promise);
  render(<StockSimpleChartContent {...base} stockId="ORDERING" />);
  expect(screen.getByTestId('stock-simple-chart-loading')).toBeTruthy();
  expect(screen.queryByTestId('drawn-series')).toBeNull();
});
