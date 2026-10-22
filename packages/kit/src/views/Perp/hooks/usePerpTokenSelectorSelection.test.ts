/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { usePerpTokenSelectorSelection } from './usePerpTokenSelectorSelection';
import { useSimpleMarketFocus } from './useSimpleMarketFocus';

let mockRouteNames = [EModalPerpRoutes.MobileTokenSelector];
let mockInstrument = { mode: 'perp', coin: 'BTC' };
const mockNavigation = {
  isFocused: jest.fn(() => true),
  popStack: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  getState: () => ({
    index: mockRouteNames.length - 1,
    routes: mockRouteNames.map((name) => ({ name })),
  }),
};
const mockSettings = { mobileTradingMode: 'simple' };
const mockProof = { source: 'token-selector' };
const mockActions = {
  captureInstrumentSwitchSubscriptionProof: jest.fn(async () => mockProof),
  switchTradeInstrument: jest.fn(async () => true),
};
const mockToast = jest.fn();
const mockActionsRef = { current: mockActions };

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => mockActionsRef,
  useActiveTradeInstrumentAtom: () => [mockInstrument],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => [mockSettings],
  appIsLocked: { get: jest.fn(async () => false) },
  useAppIsLockedAtom: () => [false],
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidSubscription: {
      getSubscriptionsHandlerDisabledCount: jest.fn(async () => 0),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: (error: unknown) => {
      mockToast(error);
    },
  },
}));

function setup() {
  const onLoadingChange = jest.fn();
  const hook = renderHook(() =>
    usePerpTokenSelectorSelection({ onLoadingChange, spotUniverses: [] }),
  );
  return { ...hook, onLoadingChange };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteNames = [EModalPerpRoutes.MobileTokenSelector];
  mockInstrument = { mode: 'perp', coin: 'BTC' };
  mockNavigation.isFocused.mockReturnValue(true);
  mockSettings.mobileTradingMode = 'simple';
  mockActions.switchTradeInstrument.mockResolvedValue(true);
  mockActions.captureInstrumentSwitchSubscriptionProof.mockResolvedValue(
    mockProof,
  );
});

it('returns a selector choice to the existing market instead of stacking a second detail', async () => {
  mockRouteNames = [
    EModalPerpRoutes.MobilePerpSimpleMarket,
    EModalPerpRoutes.MobileTokenSelector,
  ];
  const { result } = setup();
  await act(async () => {
    await result.current('ETH');
  });
  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    EModalPerpRoutes.MobilePerpSimpleMarket,
    { coin: 'ETH' },
  );
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(mockNavigation.popStack).not.toHaveBeenCalled();
});

it('restores the route instrument on return from Go to trade without changing a hidden market', async () => {
  const { rerender } = renderHook(
    ({ focused }) => useSimpleMarketFocus('BTC', focused),
    { initialProps: { focused: true } },
  );
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  mockInstrument = { mode: 'perp', coin: 'ETH' };
  rerender({ focused: false });
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  await act(async () => {
    rerender({ focused: true });
  });
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
    mode: 'perp',
    coin: 'BTC',
    subscriptionRecoveryProof: { source: 'simple-market', disabledCount: 0 },
  });
  mockInstrument = { mode: 'perp', coin: 'BTC' };
  rerender({ focused: true });
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
});

it('opens the exact HIP-3 contract only after its switch succeeds', async () => {
  let finish: (value: boolean) => void = () => {};
  mockActions.switchTradeInstrument.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve;
    }),
  );
  const { result, onLoadingChange } = setup();
  let pending: Promise<void>;
  await act(async () => {
    pending = result.current('xyz:SKHX');
    await Promise.resolve();
  });
  expect(mockNavigation.popStack).not.toHaveBeenCalled();
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
    mode: 'perp',
    coin: 'xyz:SKHX',
    subscriptionRecoveryProof: mockProof,
  });
  await act(async () => {
    finish(true);
    await pending;
  });
  expect(mockNavigation.replace).toHaveBeenCalledWith(
    EModalPerpRoutes.MobilePerpSimpleMarket,
    { coin: 'xyz:SKHX' },
  );
  expect(onLoadingChange.mock.calls).toEqual([[true], [false]]);
});

it('ignores repeated taps while selection is in flight', async () => {
  const { result } = setup();
  await act(async () => {
    await Promise.all([result.current('BTC'), result.current('ETH')]);
  });
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
  expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
});

it('does not navigate when an instrument switch is superseded', async () => {
  mockActions.switchTradeInstrument.mockResolvedValueOnce(false);
  const { result } = setup();
  await act(async () => {
    await result.current('BTC');
  });
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});

it('does not reopen details after the user closes the selector', async () => {
  mockActions.switchTradeInstrument.mockImplementationOnce(async () => {
    mockNavigation.isFocused.mockReturnValue(false);
    return true;
  });
  const { result } = setup();
  await act(async () => {
    await result.current('BTC');
  });
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});

it('keeps a failed selection retryable and shows the error', async () => {
  const error = new Error('switch failed');
  mockActions.switchTradeInstrument.mockRejectedValueOnce(error);
  const { result, onLoadingChange } = setup();
  await act(async () => {
    await result.current('BTC');
  });
  expect(mockToast).toHaveBeenCalledWith(error);
  expect(mockNavigation.popStack).not.toHaveBeenCalled();
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  await act(async () => {
    await result.current('BTC');
  });
  expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
});

it('preserves the professional selector close-and-switch flow', async () => {
  mockSettings.mobileTradingMode = 'pro';
  const { result } = setup();
  await act(async () => {
    await result.current('BTC');
  });
  expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});

it('keeps spot selection available in professional mode', async () => {
  mockSettings.mobileTradingMode = 'pro';
  const { result } = setup();
  await act(async () => {
    await result.current('@1');
  });
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
    mode: 'spot',
    coin: '@1',
    spotUniverse: undefined,
    subscriptionRecoveryProof: mockProof,
  });
  expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});

it('ignores stale spot selections in simple mode', async () => {
  const { result, onLoadingChange } = setup();
  await act(async () => {
    await result.current('@1');
  });
  expect(
    mockActions.captureInstrumentSwitchSubscriptionProof,
  ).not.toHaveBeenCalled();
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
  expect(mockNavigation.popStack).not.toHaveBeenCalled();
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(onLoadingChange).not.toHaveBeenCalled();
});
