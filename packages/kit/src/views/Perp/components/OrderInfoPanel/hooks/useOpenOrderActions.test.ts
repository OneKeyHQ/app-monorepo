/** @jest-environment jsdom */

import { act, render, renderHook } from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import type { IPerpsActiveTwapOrder } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IPerpsBboWithLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useOpenOrderActions } from './useOpenOrderActions';

let mockAddress = '0xabc';
let mockSkipOrderConfirm = true;
let mockConnected = false;
let mockBbo: IPerpsBboWithLocalReceivedAt | null = null;
const mockBboListeners = new Set<() => void>();
const dialogInstance = {
  close: () => undefined,
  getForm: () => undefined,
  isExist: () => true,
  preventClose: jest.fn(),
};
const mockFetchBook = jest
  .fn<
    Promise<{ levels: { px: string }[][]; time: number }>,
    [{ coin: string }]
  >()
  .mockImplementation(() =>
    Promise.resolve({
      levels: [[{ px: '100' }], [{ px: '101' }]],
      time: Date.now(),
    }),
  );
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockCancelTwap = jest.fn().mockResolvedValue(undefined);
const mockChase = jest.fn().mockResolvedValue(undefined);
const mockEnsure = jest.fn().mockResolvedValue(undefined);
const mockMeta = jest
  .fn<
    Promise<{ assetId: number; universe: { szDecimals: number } }>,
    unknown[]
  >()
  .mockResolvedValue({
    assetId: 12,
    universe: { szDecimals: 2 },
  });
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children: import('react').ReactNode }) =>
    createElement('div', undefined, children);
  return {
    Dialog: { show: jest.fn() },
    Toast: { error: jest.fn(), message: jest.fn() },
    Checkbox: () => null,
    SizableText: Box,
    XStack: Box,
    YStack: Box,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getSymbolMeta: (
        ...args: unknown[]
      ): Promise<{ assetId: number; universe: { szDecimals: number } }> =>
        mockMeta(...args),
      fetchL2BookByCoin: (params: { coin: string }) => mockFetchBook(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => {
  const { useSyncExternalStore } =
    jest.requireActual<typeof import('react')>('react');
  const subscribe = (listener: () => void) => {
    mockBboListeners.add(listener);
    return () => mockBboListeners.delete(listener);
  };
  return {
    useBboAtom: () => [useSyncExternalStore(subscribe, () => mockBbo)],
    useHyperliquidActions: () => ({
      current: {
        cancelOrder: mockCancel,
        cancelTwapOrder: mockCancelTwap,
        chaseOrder: mockChase,
      },
    }),
  };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  useGetBboForOrderPrice: () => () => mockBbo,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsWebSocketConnectedAtom: { atom: () => 'connected' },
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAddress }],
  usePerpsCustomSettingsAtom: () => [
    { skipOrderConfirm: mockSkipOrderConfirm },
  ],
  usePerpsWebSocketConnectedAtom: () => [mockConnected],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: { get: () => mockConnected },
}));
jest.mock('../../../hooks/useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => mockEnsure,
}));
jest.mock('../../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({
    children,
  }: {
    children: import('react').ReactNode;
  }) => children,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const order: IPerpsFrontendOrder = {
  coin: 'BTC',
  oid: 7,
  side: 'B',
  orderType: 'Limit',
  tif: 'Gtc',
  isTrigger: false,
  reduceOnly: false,
  sz: '1',
  origSz: '1',
  limitPx: '99',
  isPositionTpsl: false,
  triggerCondition: '',
  triggerPx: '0',
  timestamp: 1,
  cloid: null,
  children: [],
};

function setBbo(
  bid: string,
  ask: string,
  coin = 'BTC',
  time = Date.now(),
  localReceivedAt = time,
) {
  mockBbo = {
    coin,
    time,
    localReceivedAt,
    bbo: [
      { px: bid, sz: '1', n: 1 },
      { px: ask, sz: '1', n: 1 },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddress = '0xabc';
  mockSkipOrderConfirm = true;
  mockConnected = false;
  mockBbo = null;
});

describe.each(['simple', 'pro'] as const)('%s Chase', (tradingUiMode) => {
  it.each([
    ['B', '100'],
    ['A', '101'],
  ] as const)(
    'uses the REST queue price for side %s when BBO is for another coin',
    async (side, price) => {
      mockConnected = true;
      setBbo('200', '201', 'ETH');
      const { result } = renderHook(() =>
        useOpenOrderActions('0xabc', tradingUiMode),
      );
      await act(async () =>
        result.current.handleChaseOrderPress({ ...order, side }),
      );
      expect(mockFetchBook).toHaveBeenCalledTimes(1);
      expect(mockFetchBook).toHaveBeenCalledWith({ coin: 'BTC' });
      expect(mockChase).toHaveBeenCalledWith({
        tradingUiMode,
        coin: 'BTC',
        oid: 7,
        newPrice: price,
        expectedAccountAddress: '0xabc',
      });
    },
  );

  it.each([
    ['B', '102'],
    ['A', '103'],
  ] as const)(
    'snapshots the WS queue price at the bypass tap for side %s',
    async (side, price) => {
      mockConnected = true;
      setBbo('102', '103');
      mockEnsure.mockImplementationOnce(async () => setBbo('104', '105'));
      const { result } = renderHook(() =>
        useOpenOrderActions('0xabc', tradingUiMode),
      );
      await act(async () =>
        result.current.handleChaseOrderPress({ ...order, side }),
      );
      expect(mockChase).toHaveBeenCalledWith({
        tradingUiMode,
        coin: 'BTC',
        oid: 7,
        newPrice: price,
        expectedAccountAddress: '0xabc',
      });
      expect(mockFetchBook).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['B', '100', '102'],
    ['A', '101', '103'],
  ] as const)(
    'confirms the latest rendered target for side %s even if the feed advances',
    async (side, openingPrice, confirmedPrice) => {
      mockSkipOrderConfirm = false;
      mockConnected = true;
      setBbo('100', '101');
      const { result } = renderHook(() =>
        useOpenOrderActions('0xabc', tradingUiMode),
      );
      await act(async () =>
        result.current.handleChaseOrderPress({ ...order, side }),
      );
      const [{ renderContent, onConfirm }] = jest.mocked(Dialog.show).mock
        .calls[0];
      const modal = render(renderContent);
      expect(modal.getByText(`$${openingPrice}`)).toBeTruthy();
      act(() => {
        setBbo('102', '103');
        mockBboListeners.forEach((notify) => notify());
      });
      expect(modal.getByText(`$${confirmedPrice}`)).toBeTruthy();
      expect(modal.queryByText(`$${openingPrice}`)).toBeNull();
      setBbo('104', '105');
      await act(async () => {
        await onConfirm?.(dialogInstance);
      });
      expect(mockChase).toHaveBeenCalledWith({
        tradingUiMode,
        coin: 'BTC',
        oid: 7,
        newPrice: confirmedPrice,
        expectedAccountAddress: '0xabc',
      });
      expect(mockFetchBook).not.toHaveBeenCalled();
    },
  );
});

it('uses REST for bypass when the connected BBO has expired', async () => {
  mockConnected = true;
  const receivedAt = Date.now() - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1;
  setBbo('90', '91', 'BTC', receivedAt);
  const { result } = renderHook(() => useOpenOrderActions('0xabc'));
  await act(async () => result.current.handleChaseOrderPress(order));
  expect(mockChase).toHaveBeenCalledWith(
    expect.objectContaining({ newPrice: '100' }),
  );
  expect(mockFetchBook).toHaveBeenCalledWith({ coin: 'BTC' });
});

it('keeps a newer REST target visible when an older BBO reaches the dialog', async () => {
  mockSkipOrderConfirm = false;
  mockConnected = true;
  const restTime = Date.now();
  setBbo('90', '91', 'ETH');
  mockFetchBook.mockImplementationOnce(async () => {
    const staleTime = restTime - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1;
    setBbo('90', '91', 'BTC', staleTime);
    return {
      levels: [[{ px: '100' }], [{ px: '101' }]],
      time: restTime,
    };
  });
  const { result } = renderHook(() => useOpenOrderActions('0xabc'));
  await act(async () => result.current.handleChaseOrderPress(order));
  const [{ renderContent, onConfirm }] = jest.mocked(Dialog.show).mock.calls[0];
  const modal = render(renderContent);
  expect(modal.getByText('$100')).toBeTruthy();
  act(() => {
    setBbo('92', '93', 'BTC', restTime - 1, Date.now());
    mockBboListeners.forEach((notify) => notify());
  });
  expect(modal.getByText('$100')).toBeTruthy();
  expect(modal.queryByText('$92')).toBeNull();
  await act(async () => {
    await onConfirm?.(dialogInstance);
  });
  expect(mockChase).toHaveBeenCalledWith(
    expect.objectContaining({ newPrice: '100' }),
  );
});

it('binds Chase confirmation to the displayed account before opening trading setup', async () => {
  mockSkipOrderConfirm = false;
  setBbo('200', '201');
  const { result, rerender } = renderHook(() => useOpenOrderActions('0xabc'));
  await act(async () => result.current.handleChaseOrderPress(order));
  const [{ renderContent, onConfirm }] = jest.mocked(Dialog.show).mock.calls[0];
  const modal = render(renderContent);
  expect(modal.getByText('$100')).toBeTruthy();
  expect(mockFetchBook).toHaveBeenCalledWith({ coin: 'BTC' });
  mockAddress = '0xdef';
  rerender();
  await act(async () => {
    await onConfirm?.(dialogInstance);
  });
  expect(mockEnsure).not.toHaveBeenCalled();
  expect(mockChase).not.toHaveBeenCalled();
  expect(Toast.error).toHaveBeenCalled();
});

it.each([false, true])(
  'rejects a protected limit order with skipOrderConfirm=%s',
  async (skipOrderConfirm) => {
    mockSkipOrderConfirm = skipOrderConfirm;
    const { result } = renderHook(() => useOpenOrderActions('0xabc'));
    await act(async () =>
      result.current.handleChaseOrderPress({ ...order, isPositionTpsl: true }),
    );
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(mockFetchBook).not.toHaveBeenCalled();
    expect(mockChase).not.toHaveBeenCalled();
  },
);

it.each(['simple', 'pro'] as const)(
  'routes cancellation in %s and blocks it after an account switch',
  async (tradingUiMode) => {
    const { result, rerender } = renderHook(() =>
      useOpenOrderActions('0xabc', tradingUiMode),
    );
    await act(async () => result.current.handleCancelOrder(order));
    expect(mockCancel).toHaveBeenCalledWith({
      tradingUiMode,
      orders: [{ assetId: 12, oid: 7 }],
      expectedAccountAddress: '0xabc',
    });
    mockCancel.mockClear();
    let finishSetup: (() => void) | undefined;
    mockEnsure.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSetup = resolve;
        }),
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = result.current.handleCancelOrder(order);
    });
    mockAddress = '0xdef';
    rerender();
    await act(async () => {
      finishSetup?.();
      await pending;
    });
    expect(mockCancel).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalled();
  },
);

it('binds TWAP cancellation to the displayed account and rejects a stale callback', async () => {
  mockAddress = '0xabc';
  const twapOrder = {
    twapId: 9,
    dex: '',
    state: {
      coin: 'BTC',
      executedNtl: '0',
      executedSz: '0',
      minutes: 5,
      randomize: false,
      reduceOnly: false,
      side: 'B',
      sz: '1',
      timestamp: 1,
      user: '0xabc',
      stopPx: null,
      trigger: null,
    },
  } satisfies IPerpsActiveTwapOrder;
  const { result, rerender } = renderHook(() => useOpenOrderActions('0xabc'));
  const cancel = result.current.handleCancelTwapOrder;
  await act(async () => cancel(twapOrder));
  expect(mockCancelTwap).toHaveBeenCalledWith({
    assetId: 12,
    twapId: 9,
    expectedAccountAddress: '0xabc',
  });
  mockCancelTwap.mockClear();
  mockAddress = '0xdef';
  rerender();
  await act(async () => cancel(twapOrder));
  expect(mockCancelTwap).not.toHaveBeenCalled();
});
