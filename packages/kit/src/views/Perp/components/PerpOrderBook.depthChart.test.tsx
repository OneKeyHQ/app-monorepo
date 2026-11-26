/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { IPerpsL2BookWithLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

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
const mockReadBook = jest.fn<IPerpsL2BookWithLocalReceivedAt | null, []>();
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
      data-interaction-enabled={interactionEnabled}
      data-interactive={interactionEnabled && status === 'ready'}
      data-status={status}
    >
      {referenceMidPrice}
    </div>
  ),
}));

function createBook(bid: number): IPerpsL2BookWithLocalReceivedAt {
  const now = Date.now();
  return {
    coin: mockInstrument.coin,
    nSigFigs: null,
    mantissa: null,
    time: now,
    localReceivedAt: now,
    levels: [
      [{ px: String(bid), sz: '1', n: 1 }],
      [{ px: String(bid + 2), sz: '1', n: 1 }],
    ],
  };
}

function updateSharedBook(book: IPerpsL2BookWithLocalReceivedAt | null) {
  mockReadBook.mockReturnValue(book);
  act(() => mockBookListeners.forEach((callback) => callback()));
}

function workspaceDepthChart() {
  return <PerpOrderBook depthChart entry="perpTab" />;
}

function setModalOpen(open: boolean) {
  mockModal = open;
  mockForeground = !open;
}

async function advanceTime(ms: number) {
  await act(async () => jest.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  jest.useFakeTimers();
  setModalOpen(false);
  mockTab = ETabRoutes.Perp;
  mockSubscribe.mockClear();
  mockUnsubscribe.mockClear();
});
afterEach(() => jest.useRealTimers());

it('pauses the workspace depth feed under a modal and keeps the committed frame until fresh data returns', async () => {
  const initialBook = createBook(59_999);
  mockReadBook.mockReturnValue(initialBook);
  const { getByTestId, queryByTestId, rerender } = render(
    workspaceDepthChart(),
  );
  const depth = getByTestId('depth');
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.interactive).toBe('true');

  await advanceTime(1);
  updateSharedBook(createBook(60_099));
  expect(depth.textContent).toBe('60000');
  await advanceTime(1);
  setModalOpen(true);
  rerender(workspaceDepthChart());
  await advanceTime(PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS);
  expect(getByTestId('depth')).toBe(depth);
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.interactive).toBe('false');
  expect(depth.dataset.status).toBe('ready');
  const readsWhilePaused = mockReadBook.mock.calls.length;
  expect(mockBookListeners.size).toBe(0);
  rerender(workspaceDepthChart());
  expect(mockReadBook).toHaveBeenCalledTimes(readsWhilePaused);

  setModalOpen(false);
  rerender(workspaceDepthChart());
  expect(getByTestId('depth')).toBe(depth);
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.interactive).toBe('false');
  expect(depth.dataset.interactionEnabled).toBe('false');
  expect(depth.dataset.status).toBe('stale');
  expect(mockSubscribe).not.toHaveBeenCalled();

  updateSharedBook({
    ...createBook(60_145),
    time: Date.now() + 10_000,
    localReceivedAt: undefined,
  });
  await advanceTime(PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS);
  expect(depth.textContent).toBe('60000');
  expect(depth.dataset.status).toBe('stale');

  updateSharedBook(null);
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  await act(async () => undefined);

  updateSharedBook(createBook(60_199));
  expect(depth.textContent).toBe('60200');
  expect(depth.dataset.interactive).toBe('true');

  setModalOpen(true);
  rerender(workspaceDepthChart());
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  mockTab = ETabRoutes.Home;
  rerender(workspaceDepthChart());
  expect(queryByTestId('depth')).toBeNull();
});

it('requires a receipt after the latest pause when a second modal interrupts recovery', async () => {
  mockReadBook.mockReturnValue(createBook(59_999));
  const { getByTestId, rerender } = render(workspaceDepthChart());
  const depth = getByTestId('depth');

  setModalOpen(true);
  rerender(workspaceDepthChart());
  await advanceTime(1);
  setModalOpen(false);
  rerender(workspaceDepthChart());
  expect(depth.dataset.status).toBe('stale');

  await advanceTime(1);
  updateSharedBook(createBook(60_099));
  expect(depth.dataset.status).toBe('stale');
  await advanceTime(1);
  setModalOpen(true);
  rerender(workspaceDepthChart());
  await advanceTime(1);
  setModalOpen(false);
  rerender(workspaceDepthChart());
  expect(depth.dataset.status).toBe('stale');
  expect(depth.textContent).toBe('60000');

  updateSharedBook(createBook(60_199));
  await advanceTime(PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS);
  expect(depth.textContent).toBe('60200');
  expect(depth.dataset.interactive).toBe('true');
});

it('keeps the retained frame on a recovery error and clears it for a fresh empty book', async () => {
  mockReadBook.mockReturnValue(createBook(59_999));
  const { getByTestId, rerender } = render(workspaceDepthChart());
  const depth = getByTestId('depth');

  setModalOpen(true);
  rerender(workspaceDepthChart());
  await advanceTime(1);
  mockReadBook.mockReturnValue(null);
  mockSubscribe.mockRejectedValueOnce(new Error('Depth subscription failed'));
  setModalOpen(false);
  rerender(workspaceDepthChart());
  await act(async () => undefined);
  expect(depth.dataset.status).toBe('error');
  expect(depth.dataset.interactionEnabled).toBe('false');
  expect(depth.textContent).toBe('60000');

  updateSharedBook({ ...createBook(60_199), levels: [[], []] });
  expect(depth.dataset.status).toBe('empty');
  expect(depth.textContent).toBe('');
});
