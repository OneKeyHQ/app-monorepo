/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useSimpleMarketFocus } from './useSimpleMarketFocus';

const mockNavigation = { isFocused: jest.fn(() => true) };
const mockInstrument = { mode: 'perp', coin: 'ETH' };
const mockActions = { switchTradeInstrument: jest.fn(async () => true) };
const mockActionsRef = { current: mockActions };
const mockIsLocked = jest.fn(async () => false);
const mockIsVisible = jest.fn(() => true);
const mockDisabledCount = jest.fn(async () => 3);
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
