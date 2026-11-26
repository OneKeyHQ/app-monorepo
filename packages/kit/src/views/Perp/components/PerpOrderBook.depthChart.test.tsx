/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS } from '../utils/orderBookVisualScheduler';

import { PerpOrderBook } from './PerpOrderBook';

const mockInstrument = {
  coin: 'BTC',
  mode: 'perp',
  universe: { szDecimals: 5 },
};
let mockModal = false;
let mockTab = ETabRoutes.Perp;
let mockForeground = true;
const mockReadBook = jest.fn<IBook | null, []>();
const mockBookListeners = new Set<() => void>();
const mockListenToBook = (callback: () => void) => {
  mockBookListeners.add(callback);
  return () => mockBookListeners.delete(callback);
};
const mockSubscribe = jest.fn<Promise<undefined>, []>(async () => undefined);
const mockUnsubscribe = jest.fn<Promise<undefined>, []>(async () => undefined);

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      addListener: () => () => undefined,
      getRootState: () => ({
        index: mockModal ? 1 : 0,
        routes: [
          {
            name: ERootRoutes.Main,
            state: {
              index: 0,
              routes: [
                {
                  name: mockTab,
                  state: { index: 0, routes: [{ name: mockTab }] },
                },
              ],
            },
          },
          ...(mockModal ? [{ name: ERootRoutes.Modal }] : []),
        ],
      }),
    },
  },
  YStack: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidSubscription: {
      subscribePublicDepthBook: () => mockSubscribe(),
      unsubscribePublicDepthBook: () => mockUnsubscribe(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => {
  const { useSyncExternalStore } =
    jest.requireActual<typeof import('react')>('react');
  return {
    useActiveTradeInstrumentAtom: () => [mockInstrument],
    useL2BookAtom: () => [useSyncExternalStore(mockListenToBook, mockReadBook)],
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsWebSocketConnectedAtom: () => [true],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    HyperliquidPublicDepthBook: 'HyperliquidPublicDepthBook',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({}));
jest.mock('../hooks/useFundingCountdown', () => ({}));
jest.mock('../hooks/usePerpMarketData', () => ({}));
jest.mock('../hooks/usePerpMarketForeground', () => ({
  usePerpMarketForeground: () => mockForeground,
}));
jest.mock('../hooks/usePerpsAccountDisplayState', () => ({}));
jest.mock('../hooks/usePerpsActiveAssetCtxDisplay', () => ({}));
jest.mock('../hooks/useShowPortfolio', () => ({}));
jest.mock('../PerpsProviderMirror', () => ({}));
jest.mock('./OrderBook', () => ({}));
jest.mock('./OrderBook/DefaultLoadingNode', () => ({}));
jest.mock('./OrderBook/useTickOptions', () => ({}));
jest.mock('./OrderBook/PerpDepthChart', () => ({
  PerpDepthChart: ({
    interactionEnabled = true,
    referenceMidPrice,
    status,
  }: {
    interactionEnabled?: boolean;
    referenceMidPrice?: number;
    status: string;
  }) => (
    <div
      data-testid="depth"
      data-interactive={interactionEnabled && status === 'ready'}
      data-status={status}
    >
      {referenceMidPrice}
    </div>
  ),
}));

function createBook(bid: number, time = Date.now()): IBook {
  return {
    coin: mockInstrument.coin,
    nSigFigs: null,
    mantissa: null,
    time,
    levels: [
      [{ px: String(bid), sz: '1', n: 1 }],
      [{ px: String(bid + 2), sz: '1', n: 1 }],
    ],
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('pauses the workspace depth feed under a modal and keeps the committed frame until fresh data returns', async () => {
  const initialBook = createBook(59_999);
  mockReadBook.mockReturnValue(initialBook);
  const chart = <PerpOrderBook depthChart entry="perpTab" />;
  const { getByTestId, queryByTestId, rerender } = render(chart);
  const depth = getByTestId('depth');
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.interactive).toBe('true');

  mockReadBook.mockReturnValue(createBook(60_099));
  act(() => mockBookListeners.forEach((callback) => callback()));
  expect(depth.textContent).toBe('60000');
  mockModal = true;
  mockForeground = false;
  rerender(<PerpOrderBook depthChart entry="perpTab" />);
  await act(async () =>
    jest.advanceTimersByTimeAsync(PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS),
  );
  expect(getByTestId('depth')).toBe(depth);
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.interactive).toBe('false');
  expect(depth.dataset.status).toBe('ready');
  const readsWhilePaused = mockReadBook.mock.calls.length;
  expect(mockBookListeners.size).toBe(0);
  mockReadBook.mockReturnValue(initialBook);
  rerender(<PerpOrderBook depthChart entry="perpTab" />);
  expect(mockReadBook).toHaveBeenCalledTimes(readsWhilePaused);

  mockModal = false;
  mockForeground = true;
  rerender(<PerpOrderBook depthChart entry="perpTab" />);
  expect(getByTestId('depth')).toBe(depth);
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.interactive).toBe('false');
  expect(depth.dataset.status).toBe('stale');
  expect(mockSubscribe).not.toHaveBeenCalled();

  mockReadBook.mockReturnValue(null);
  act(() => mockBookListeners.forEach((callback) => callback()));
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  await act(async () => undefined);

  mockReadBook.mockReturnValue(createBook(60_199, initialBook.time + 1));
  act(() => mockBookListeners.forEach((callback) => callback()));
  expect(depth.textContent).toBe('60200');
  expect(depth.dataset.interactive).toBe('true');

  mockModal = true;
  mockForeground = false;
  rerender(<PerpOrderBook depthChart entry="perpTab" />);
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  mockTab = ETabRoutes.Home;
  rerender(<PerpOrderBook depthChart entry="perpTab" />);
  expect(queryByTestId('depth')).toBeNull();
});
