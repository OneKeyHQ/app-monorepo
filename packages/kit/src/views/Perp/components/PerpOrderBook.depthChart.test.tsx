/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { markPerpsL2BookReceived } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import type { IPerpsL2BookWithLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
const mockReadBook = jest.fn<IPerpsL2BookWithLocalReceivedAt | null, []>();
const mockBookListeners = new Set<() => void>();
const mockListenToBook = (callback: () => void) => {
  mockBookListeners.add(callback);
  return () => mockBookListeners.delete(callback);
};
const mockSubscribe = jest.fn<
  Promise<{ book: IBook; receivedAt: number } | undefined>,
  []
>(async () => undefined);
const mockUnsubscribe = jest.fn<Promise<undefined>, []>(async () => undefined);
type IDepthBookEvent =
  IAppEventBusPayload[EAppEventBusNames.HyperliquidPublicDepthBook];
const mockDepthBookListen = jest.fn<
  void,
  [string, (event: IDepthBookEvent) => void]
>();

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
  appEventBus: {
    on: (type: string, listener: (event: IDepthBookEvent) => void) =>
      mockDepthBookListen(type, listener),
    off: jest.fn(),
  },
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

function createRawBook(bid: number): IBook {
  return {
    coin: mockInstrument.coin,
    nSigFigs: null,
    mantissa: null,
    time: Date.now(),
    levels: [
      [{ px: String(bid), sz: '1', n: 1 }],
      [{ px: String(bid + 2), sz: '1', n: 1 }],
    ],
  };
}

function createBook(bid: number): IPerpsL2BookWithLocalReceivedAt {
  return {
    ...markPerpsL2BookReceived(createRawBook(bid)),
    localReceivedAt: Date.now(),
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
  mockDepthBookListen.mockClear();
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
    receiptSequence: undefined,
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

it('rejects a shared book queued before the latest pause even if the atom receives it later', async () => {
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
  const queuedBook = createBook(60_099);
  await advanceTime(1);
  setModalOpen(true);
  rerender(workspaceDepthChart());
  await advanceTime(1);
  updateSharedBook({ ...queuedBook, localReceivedAt: Date.now() });
  setModalOpen(false);
  rerender(workspaceDepthChart());
  expect(depth.dataset.status).toBe('stale');
  expect(depth.textContent).toBe('60000');

  updateSharedBook(createBook(60_199));
  await advanceTime(PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS);
  expect(depth.textContent).toBe('60200');
  expect(depth.dataset.interactive).toBe('true');
});

it('reports recovery failure despite a stale matching shared book and recovers to a fresh empty book', async () => {
  mockReadBook.mockReturnValue(createBook(59_999));
  const { getByTestId, rerender } = render(workspaceDepthChart());
  const depth = getByTestId('depth');

  setModalOpen(true);
  rerender(workspaceDepthChart());
  await advanceTime(PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS + 1);
  mockSubscribe.mockRejectedValueOnce(new Error('Depth subscription failed'));
  setModalOpen(false);
  rerender(workspaceDepthChart());
  await act(async () => undefined);
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  expect(depth.dataset.status).toBe('error');
  expect(depth.dataset.interactionEnabled).toBe('false');
  expect(depth.textContent).toBe('60000');

  updateSharedBook({ ...createBook(60_199), levels: [[], []] });
  expect(depth.dataset.status).toBe('empty');
  expect(depth.textContent).toBe('');
});

it.each([0, 60_000])(
  'rejects warm independent replay and accepts live receipts with a %ims wall clock rollback',
  async (rollbackMs) => {
    mockReadBook.mockReturnValue(createBook(59_999));
    const { getByTestId, rerender } = render(workspaceDepthChart());
    const depth = getByTestId('depth');
    const warmBook = createRawBook(60_099);
    mockSubscribe.mockResolvedValueOnce({
      book: warmBook,
      receivedAt: Date.now(),
    });

    setModalOpen(true);
    rerender(workspaceDepthChart());
    mockReadBook.mockReturnValue(null);
    jest.setSystemTime(Date.now() - rollbackMs);
    setModalOpen(false);
    rerender(workspaceDepthChart());
    await act(async () => undefined);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(depth.dataset.status).toBe('stale');
    expect(depth.textContent).toBe('60000');

    updateSharedBook(createBook(60_199));
    expect(depth.dataset.interactive).toBe('true');
    expect(depth.textContent).toBe('60200');

    const onLiveDepthBook = mockDepthBookListen.mock.lastCall?.[1];
    await act(async () =>
      onLiveDepthBook?.({
        status: 'ready',
        coin: mockInstrument.coin,
        options: { nSigFigs: null, mantissa: null },
        book: createRawBook(60_299),
        receivedAt: Date.now(),
      }),
    );
    expect(depth.dataset.interactive).toBe('true');
    expect(depth.textContent).toBe('60300');
  },
);
