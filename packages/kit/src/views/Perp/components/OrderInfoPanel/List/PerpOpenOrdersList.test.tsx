/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IL2BookResponse,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PerpOpenOrdersList } from './PerpOpenOrdersList';

const mockChaseOrder = jest.fn().mockResolvedValue(undefined);
const mockEnsureTradingEnabled = jest.fn().mockResolvedValue(undefined);
const mockFetchBook = jest.fn<Promise<IL2BookResponse>, [{ coin: string }]>();
const mockSubscribe = jest
  .fn<Promise<void>, [{ coin: string; subscriptionId: string }]>()
  .mockResolvedValue(undefined);
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
let mockAccountAddress = '0xabcd';
let mockSkipConfirm = false;
let mockOrder: IPerpsFrontendOrder;
const mockActions = { current: { chaseOrder: mockChaseOrder } };
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Checkbox: () => null,
  Dialog: { show: jest.fn() },
  Toast: { error: jest.fn() },
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidSubscription: {
      subscribeChaseOrderBook: (params: {
        coin: string;
        subscriptionId: string;
      }) => mockSubscribe(params),
      unsubscribeChaseOrderBook: (params: {
        coin: string;
        subscriptionId: string;
      }) => mockUnsubscribe(params) as Promise<void>,
    },
    serviceHyperliquid: {
      getSymbolMeta: async () => ({
        universe: { szDecimals: 2 },
        isSpot: false,
      }),
      fetchL2BookByCoin: (params: { coin: string }) => mockFetchBook(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => mockActions,
  useActiveTradeInstrumentAtom: () => [{ coin: 'BTC' }],
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  useOrderFilterByCurrentTokenAtom: () => [false],
  usePerpsActiveOpenOrdersAtom: () => [
    { accountAddress: '0xabcd', openOrders: [mockOrder] },
  ],
  usePerpsActiveTwapOrdersAtom: () => [
    { accountAddress: '0xabcd', twapOrders: [] },
  ],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAccountAddress }],
  usePerpsCustomSettingsAtom: () => [
    { skipOrderConfirm: mockSkipConfirm },
    jest.fn(),
  ],
  useSpotActiveOpenOrdersAtom: () => [
    { accountAddress: '0xabcd', openOrders: [] },
  ],
}));
jest.mock('../../../hooks/usePerpsAccountScopedCacheAddress', () => ({
  usePerpsAccountScopedCacheAddress: () => mockAccountAddress,
}));
jest.mock('../../../hooks/usePerpsAccountScopedActiveTwapOrders', () => ({
  usePerpsAccountScopedActiveTwapOrders: () => ({
    twapOrders: [],
    activeRuntimeInfoById: {},
  }),
}));
jest.mock('../../../hooks/useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => mockEnsureTradingEnabled,
}));
jest.mock('../CancelAllOrdersModal', () => ({
  showCancelAllOrdersDialog: jest.fn(),
}));
jest.mock('../Components/OpenOrdersRow', () => ({
  OpenOrdersRow: ({ handleChaseOrder }: { handleChaseOrder: () => void }) => (
    <button onClick={handleChaseOrder}>Chase</button>
  ),
}));
jest.mock('../Components/MobileOpenOrdersListHeader', () => ({
  MobileOpenOrdersListHeader: () => null,
}));
jest.mock('../Components/MobileTwapOpenOrdersRow', () => ({
  MobileTwapOpenOrdersRow: () => null,
}));
jest.mock('../Components/OrderInfoSubTabs', () => ({
  OrderInfoSubTabs: () => null,
}));
jest.mock('../Components/PerpMobileEmptyState', () => ({
  PerpMobileEmptyState: () => null,
}));
jest.mock('./CommonTableListView', () => ({
  CommonTableListView: ({
    data,
    renderRow,
  }: {
    data: { type: 'single'; order: IPerpsFrontendOrder }[];
    renderRow: (
      row: { type: 'single'; order: IPerpsFrontendOrder },
      index: number,
    ) => ReactNode;
  }) => (
    <div>
      {data.map((row, index) => (
        <div key={row.order.oid}>{renderRow(row, index)}</div>
      ))}
    </div>
  ),
}));

type IConfirmOptions = {
  renderContent: ReactElement;
  onConfirm: () => Promise<void>;
};

function setBook(bid: string, ask: string) {
  mockFetchBook.mockResolvedValue({
    coin: mockOrder.coin,
    time: Date.now(),
    levels: [[{ px: bid, sz: '1', n: 1 }], [{ px: ask, sz: '1', n: 1 }]],
  });
}

async function openConfirmation() {
  const view = render(<PerpOpenOrdersList />);
  fireEvent.click(view.getByText('Chase'));
  await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
  const options = jest.mocked(Dialog.show).mock.calls[0][0] as IConfirmOptions;
  return { view, options };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountAddress = '0xabcd';
  mockSkipConfirm = false;
  mockOrder = {
    coin: 'ETH',
    oid: 1,
    side: 'B',
    limitPx: '2200',
    sz: '0.1',
    origSz: '0.1',
    tif: 'Gtc',
    orderType: 'Limit',
    reduceOnly: false,
    isTrigger: false,
    isPositionTpsl: false,
    triggerPx: '0',
    triggerCondition: '',
    timestamp: 1,
    cloid: null,
    children: [],
  };
  setBook('2318.3', '2318.4');
});

it.each([
  ['B', '2317.9', '2318.0', '2317.9'],
  ['A', '2318.8', '2318.9', '2318.9'],
] as const)(
  'refreshes the %s chase price after confirmation and trading guards',
  async (side, bid, ask, expectedPrice) => {
    mockOrder.side = side;
    const { options } = await openConfirmation();
    mockEnsureTradingEnabled.mockImplementationOnce(async () =>
      setBook(bid, ask),
    );
    await act(async () => options.onConfirm());
    expect(mockChaseOrder).toHaveBeenCalledWith({
      coin: 'ETH',
      oid: 1,
      newPrice: expectedPrice,
      expectedAccountAddress: '0xabcd',
    });
    expect(mockFetchBook).toHaveBeenLastCalledWith({ coin: 'ETH' });
  },
);

it('does not submit the opening price when the latest book is unavailable', async () => {
  const { options } = await openConfirmation();
  setBook('', '');
  await act(async () => options.onConfirm());
  expect(mockChaseOrder).not.toHaveBeenCalled();
  expect(Toast.error).toHaveBeenCalled();
});

it('rejects an account switch while the confirmation is open', async () => {
  const { view, options } = await openConfirmation();
  mockAccountAddress = '0xdef0';
  view.rerender(<PerpOpenOrdersList />);
  await act(async () => options.onConfirm());
  expect(mockChaseOrder).not.toHaveBeenCalled();
  expect(Toast.error).toHaveBeenCalled();
});

it('uses a fresh same-side price when confirmation is skipped', async () => {
  mockSkipConfirm = true;
  mockEnsureTradingEnabled.mockImplementationOnce(async () =>
    setBook('2317.9', '2318.0'),
  );
  const view = render(<PerpOpenOrdersList />);
  fireEvent.click(view.getByText('Chase'));
  await waitFor(() =>
    expect(mockChaseOrder).toHaveBeenCalledWith({
      coin: 'ETH',
      oid: 1,
      newPrice: '2317.9',
      expectedAccountAddress: '0xabcd',
    }),
  );
  expect(Dialog.show).not.toHaveBeenCalled();
});

it.each([
  ['B', '$2,318.3'],
  ['A', '$2,318.4'],
] as const)(
  'shows the %s side from the order coin stream without HTTP polling',
  async (side, expectedPrice) => {
    jest.useFakeTimers();
    try {
      mockOrder.side = side;
      const { options } = await openConfirmation();
      const dialog = render(options.renderContent);
      await act(async () => undefined);
      const params = mockSubscribe.mock.calls[0][0];
      expect(params.coin).toBe('ETH');
      expect(dialog.getByText('--')).toBeTruthy();
      await act(() =>
        appEventBus.emit(EAppEventBusNames.PerpsChaseOrderBookUpdate, {
          ...params,
          subscriptionId: `${params.subscriptionId}-stale`,
          bestBid: '100',
          bestAsk: '101',
        }),
      );
      expect(dialog.getByText('--')).toBeTruthy();
      await act(() =>
        appEventBus.emit(EAppEventBusNames.PerpsChaseOrderBookUpdate, {
          ...params,
          coin: 'BTC',
          bestBid: '100',
          bestAsk: '101',
        }),
      );
      expect(dialog.getByText('--')).toBeTruthy();
      await act(() =>
        appEventBus.emit(EAppEventBusNames.PerpsChaseOrderBookUpdate, {
          ...params,
          bestBid: '2318.3',
          bestAsk: '2318.4',
        }),
      );
      expect(dialog.getByText(expectedPrice)).toBeTruthy();
      await act(async () => jest.advanceTimersByTimeAsync(60_000));
      expect(dialog.getByText(expectedPrice)).toBeTruthy();
      expect(mockFetchBook).not.toHaveBeenCalled();
      await act(() =>
        appEventBus.emit(EAppEventBusNames.PerpsChaseOrderBookUpdate, params),
      );
      expect(dialog.getByText('--')).toBeTruthy();
      dialog.unmount();
      expect(mockUnsubscribe).toHaveBeenCalledWith(params);
    } finally {
      jest.useRealTimers();
    }
  },
);

it('releases a subscription acquired after the confirmation has closed', async () => {
  let finishAcquire: () => void = () => undefined;
  mockSubscribe.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishAcquire = resolve;
      }),
  );
  const { options } = await openConfirmation();
  const dialog = render(options.renderContent);
  dialog.unmount();
  expect(mockUnsubscribe).not.toHaveBeenCalled();
  await act(async () => finishAcquire());
  expect(mockUnsubscribe).toHaveBeenCalledWith(mockSubscribe.mock.calls[0][0]);
});
