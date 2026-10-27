/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import type { IMarketAccountPortfolioResponse } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  SwapStockPositionsProvider,
  useSwapStockPositions,
} from './SwapStockPositions';

let mockFocused = true;
let mockStockId = 'AAPL';
const mockLoad = jest.fn();
const mockFetch = jest.fn<
  Promise<IMarketAccountPortfolioResponse>,
  [unknown]
>();
const mockTokens: ISwapToken[] = [
  {
    networkId: 'evm--1',
    contractAddress: '0xAABB',
    accountAddress: 'account-a',
    symbol: 'AAPLon',
    decimals: 18,
    balanceParsed: '2',
    fiatValue: '200',
    price: '100',
    currency: 'usd',
    stock: { stockId: 'AAPL', subtitle: '', sourceLogoUri: '' },
  },
];

jest.mock('@onekeyhq/components', () => {
  const { useMemo } = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    YStack: Stack,
    XStack: Stack,
    SizableText: Stack,
    Checkbox: Stack,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useDeferredPromise: () =>
      useMemo(
        () => ({
          resolve: () => {},
          reset: () => {},
          promise: Promise.resolve(),
        }),
        [],
      ),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
  useRouteIsFocusedWhenEnabled: () => mockFocused,
}));
jest.mock('../../hooks/useSwapPro', () => ({
  useSwapProSupportNetworksTokenList: () => ({
    hasAccount: true,
    positionTokenList: mockTokens,
    positionLoading: false,
    positionLoadError: false,
    resolvedNetworkIds: ['evm--1'],
    swapProLoadSupportNetworksTokenListRun: mockLoad,
  }),
  useSwapProPositionsListFilter: () => ({ finallyTokenList: mockTokens }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapProEnableCurrentSymbolAtom: () => [false, jest.fn()],
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({
    useStockDetail: () => ({ stockId: mockStockId, tokenVariants: [] }),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (params: unknown) => mockFetch(params),
    },
  },
}));
jest.mock('../../../Perp/layouts/PerpMobileLayout', () => ({
  ETabName: {},
  TabBarItem: () => null,
}));
jest.mock('./SwapProPositionsList', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./SwapStockMarketProvider', () => ({
  useSwapStockSelection: () => undefined,
}));
jest.mock('./SwapStockTradeProvider', () => ({
  useSwapStockTradeContext: () => ({}),
}));

const originalIdle = globalThis.requestIdleCallback;
const originalCancelIdle = globalThis.cancelIdleCallback;

const networks = [{ networkId: 'evm--1', name: 'Ethereum', symbol: 'ETH' }];
function Consumer({ name }: { name: string }) {
  const data = useSwapStockPositions();
  const pnl = data?.pnlMap.get('evm--1-0xAABB');
  return (
    <div data-testid={name}>
      {JSON.stringify({
        pnl: pnl?.totalPnlUsd,
        portfolio: data?.portfolio.positionListData.map((item) => ({
          amount: item.amount,
          pnl: item.pnl?.totalPnlUsd,
        })),
      })}
    </div>
  );
}
function App({ ready = true }: { ready?: boolean }) {
  return (
    <SwapStockPositionsProvider networks={networks} ready={ready}>
      <Consumer name="left" />
      <Consumer name="right" />
    </SwapStockPositionsProvider>
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  globalThis.requestIdleCallback = (callback) =>
    Number(
      globalThis.setTimeout(
        () => callback({ didTimeout: false, timeRemaining: () => 50 }),
        0,
      ),
    );
  globalThis.cancelIdleCallback = (id) => globalThis.clearTimeout(id);
  mockFocused = true;
  mockStockId = 'AAPL';
  mockLoad.mockReset();
  mockFetch.mockReset().mockResolvedValue({
    list: [
      {
        accountAddress: 'account-a',
        tokenAddress: '0xAABB',
        amount: '2',
        symbol: 'AAPLon',
        tokenPrice: '100',
        totalPrice: '200',
        pnl: {
          isPnlSupported: true,
          totalPnlUsd: '12',
          totalPnlPercent: '6',
          unrealizedPnlUsd: '8',
          unrealizedPnlPercent: '4',
        },
      },
    ],
  });
});
afterEach(() => {
  globalThis.requestIdleCallback = originalIdle;
  globalThis.cancelIdleCallback = originalCancelIdle;
  jest.useRealTimers();
});

it('shares one PnL read and one portfolio projection between both consumers', async () => {
  const { rerender, unmount } = render(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('left').textContent).toBe(
    screen.getByTestId('right').textContent,
  );
  expect(JSON.parse(screen.getByTestId('left').textContent ?? '{}')).toEqual({
    pnl: '12',
    portfolio: [{ amount: '2', pnl: '12' }],
  });
  mockStockId = 'MSFT';
  rerender(<App />);
  expect(
    JSON.parse(screen.getByTestId('left').textContent ?? '{}').portfolio,
  ).toEqual([]);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  unmount();
});

it('refreshes native holdings while focused and stops on blur, not-ready and unmount', async () => {
  const { rerender, unmount } = render(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(mockLoad).toHaveBeenCalledTimes(2);
  mockFocused = false;
  rerender(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(mockLoad).toHaveBeenCalledTimes(2);
  mockFocused = true;
  rerender(<App ready={false} />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(mockLoad).toHaveBeenCalledTimes(2);
  rerender(<App />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(15_000);
  });
  expect(mockLoad).toHaveBeenCalledTimes(3);
  unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(mockLoad).toHaveBeenCalledTimes(3);
});
