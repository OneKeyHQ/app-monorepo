/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useSimpleMarketFocus } from './useSimpleMarketFocus';

const mockNavigation = {
  addListener: jest.fn((_event: 'blur', _listener: () => void) => () => {}),
  isFocused: jest.fn(() => true),
};
const mockInstrument: {
  mode: string;
  coin: string;
  assetId?: number;
  universe?: { name: string };
} = { mode: 'perp', coin: 'ETH' };
const mockActions = {
  switchTradeInstrument: jest.fn(
    async (_params: { restorationSignal: AbortSignal }) => true,
  ),
};
const mockActionsRef = { current: mockActions };
const mockIsLocked = jest.fn(async () => false);
const mockIsVisible = jest.fn(() => true);
const mockDisabledCount = jest.fn(async () => 3);
const mockRefreshTradingMeta = jest.fn(async () => {});
let mockLocked = false;
let mockVisibilityListener: ((visible: boolean) => void) | undefined;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [mockInstrument],
  useHyperliquidActions: () => mockActionsRef,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  appIsLocked: { get: () => mockIsLocked() },
  useAppIsLockedAtom: () => [mockLocked],
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockIsVisible(),
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityListener = listener;
    return () => {
      mockVisibilityListener = undefined;
    };
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: { refreshTradingMeta: () => mockRefreshTradingMeta() },
    serviceHyperliquidSubscription: {
      getSubscriptionsHandlerDisabledCount: () => mockDisabledCount(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockInstrument.coin = 'ETH';
  mockInstrument.assetId = 0;
  mockInstrument.universe = { name: 'ETH' };
  mockLocked = false;
  mockNavigation.isFocused.mockReturnValue(true);
  mockIsLocked.mockResolvedValue(false);
  mockIsVisible.mockReturnValue(true);
  mockDisabledCount.mockResolvedValue(3);
});

it('restores the focused market with a fresh subscription recovery proof', async () => {
  await act(async () => {
    renderHook(() => useSimpleMarketFocus('BTC', true));
  });
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
    mode: 'perp',
    coin: 'BTC',
    restorationSignal: expect.any(AbortSignal),
    subscriptionRecoveryProof: { source: 'simple-market', disabledCount: 3 },
  });
});

it.each(['blurred', 'locked', 'hidden', 'current'])(
  'does not switch for a %s market',
  async (condition) => {
    if (condition === 'locked') mockIsLocked.mockResolvedValue(true);
    if (condition === 'hidden') mockIsVisible.mockReturnValue(false);
    if (condition === 'current') mockInstrument.coin = 'BTC';
    await act(async () => {
      renderHook(() => useSimpleMarketFocus('BTC', condition !== 'blurred'));
    });
    expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  },
);

it('retries after a pending proof is discarded while the app is hidden', async () => {
  let finish = (_count: number) => {};
  mockDisabledCount.mockReturnValueOnce(
    new Promise<number>((resolve) => {
      finish = resolve;
    }),
  );
  renderHook(() => useSimpleMarketFocus('BTC', true));
  await act(async () => {});
  mockIsVisible.mockReturnValue(false);
  act(() => mockVisibilityListener?.(false));
  await act(async () => finish(3));
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  mockIsVisible.mockReturnValue(true);
  await act(async () => mockVisibilityListener?.(true));
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
});

it('restores the market after unlocking a focused page', async () => {
  mockLocked = true;
  mockIsLocked.mockResolvedValue(true);
  const { rerender } = renderHook(() => useSimpleMarketFocus('BTC', true));
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  mockLocked = false;
  mockIsLocked.mockResolvedValue(false);
  await act(async () => rerender());
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
});

it.each(['blur', 'unmount'])(
  'discards a pending recovery proof after %s',
  async (condition) => {
    let finish = (_count: number) => {};
    mockDisabledCount.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    const { unmount } = renderHook(() => useSimpleMarketFocus('BTC', true));
    await act(async () => {});
    expect(mockDisabledCount).toHaveBeenCalledTimes(1);
    if (condition === 'blur') mockNavigation.isFocused.mockReturnValue(false);
    else unmount();
    await act(async () => finish(3));
    expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  },
);

it.each(['blur', 'unmount'])(
  'aborts a switch already in flight on %s',
  async (reason) => {
    let finish!: (result: boolean) => void;
    mockActions.switchTradeInstrument.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = renderHook(() => useSimpleMarketFocus('BTC', true));
    await act(async () => {});
    const [{ restorationSignal }] =
      mockActions.switchTradeInstrument.mock.calls[0];
    expect(restorationSignal.aborted).toBe(false);
    if (reason === 'blur')
      act(() => mockNavigation.addListener.mock.calls[0][1]());
    else unmount();
    expect(restorationSignal.aborted).toBe(true);
    await act(async () => finish(false));
  },
);

it('refreshes metadata and retries a failed switch only on request', async () => {
  mockActions.switchTradeInstrument.mockResolvedValueOnce(false);
  const { result } = renderHook(() => useSimpleMarketFocus('BTC', true));
  await act(async () => {});
  expect(result.current.failed).toBe(true);
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
  await act(async () => result.current.retry());
  expect(mockRefreshTradingMeta).toHaveBeenCalledTimes(1);
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(2);
  expect(mockRefreshTradingMeta.mock.invocationCallOrder[0]).toBeLessThan(
    mockActions.switchTradeInstrument.mock.invocationCallOrder[1],
  );
  expect(result.current.failed).toBe(false);
});

it('keeps Retry available when the proof for a retry cannot be read', async () => {
  mockActions.switchTradeInstrument.mockResolvedValueOnce(false);
  const { result } = renderHook(() => useSimpleMarketFocus('BTC', true));
  await act(async () => {});
  expect(result.current.failed).toBe(true);
  mockDisabledCount.mockRejectedValueOnce(new Error('IPC unavailable'));
  await act(async () => result.current.retry());
  expect(result.current.failed).toBe(true);
  expect(result.current.isSwitching).toBe(false);
});

it('consumes the requested metadata refresh before the next focus', async () => {
  mockActions.switchTradeInstrument.mockResolvedValueOnce(false);
  const { result, rerender } = renderHook(
    ({ focused }) => useSimpleMarketFocus('BTC', focused),
    { initialProps: { focused: true } },
  );
  await act(async () => {});
  await act(async () => result.current.retry());
  expect(mockRefreshTradingMeta).toHaveBeenCalledTimes(1);
  mockInstrument.coin = 'BTC';
  rerender({ focused: false });
  mockInstrument.coin = 'ETH';
  await act(async () => rerender({ focused: true }));
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(3);
  expect(mockRefreshTradingMeta).toHaveBeenCalledTimes(1);
});

it.each(['assetId', 'universe'] as const)(
  'loads the focused coin when its %s is missing',
  async (field) => {
    mockInstrument[field] = undefined;
    await act(async () => {
      renderHook(() => useSimpleMarketFocus('ETH', true));
    });
    expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
  },
);
