/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { usePerpGoToTrade } from './usePerpGoToTrade';

const mockNavigation = {
  isFocused: jest.fn(() => true),
  popStack: jest.fn(),
  replace: jest.fn(),
};
const mockSettings = { mobileTradingMode: 'simple' };
const mockSetSettings = jest.fn();
const mockPlatform = platformEnv as { isNative: boolean };
const mockMedia = { gtMd: false };
const mockProof = { source: 'trade-history-details' };
const mockActions = {
  captureInstrumentSwitchSubscriptionProof: jest.fn(async () => mockProof),
  switchTradeInstrument: jest.fn(async () => true),
};
const mockToast = jest.fn();

jest.mock('@react-navigation/core', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@onekeyhq/components', () => ({ useMedia: () => mockMedia }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({ current: mockActions }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => [mockSettings, mockSetSettings],
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: (error: unknown) => {
      mockToast(error);
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.isFocused.mockReturnValue(true);
  mockSettings.mobileTradingMode = 'simple';
  mockPlatform.isNative = true;
  mockMedia.gtMd = false;
  mockActions.switchTradeInstrument.mockResolvedValue(true);
  mockActions.captureInstrumentSwitchSubscriptionProof.mockResolvedValue(
    mockProof,
  );
});

it.each([true, false])(
  'opens the exact contract in simple mode (native: %s)',
  async (isNative) => {
    mockPlatform.isNative = isNative;
    const { result } = renderHook(usePerpGoToTrade);
    await act(async () => {
      await result.current.goToTrade('xyz:CRWV');
    });
    expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'xyz:CRWV',
      subscriptionRecoveryProof: mockProof,
    });
    expect(mockNavigation.replace).toHaveBeenCalledWith(
      EModalPerpRoutes.MobilePerpSimpleMarket,
      { coin: 'xyz:CRWV' },
    );
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
  },
);

it('waits for the switch and ignores repeated taps', async () => {
  let finish: (value: boolean) => void = () => {};
  mockActions.switchTradeInstrument.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = renderHook(usePerpGoToTrade);
  let pending: Promise<void>;
  await act(async () => {
    pending = result.current.goToTrade('BTC');
    await result.current.goToTrade('ETH');
  });
  expect(result.current.switchingAsset).toBe(true);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(true);
    await pending;
  });
  expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
  expect(result.current.switchingAsset).toBe(false);
});

it('does not navigate after a superseded switch', async () => {
  mockActions.switchTradeInstrument.mockResolvedValueOnce(false);
  const { result } = renderHook(usePerpGoToTrade);
  await act(async () => {
    await result.current.goToTrade('BTC');
  });
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(mockNavigation.popStack).not.toHaveBeenCalled();
});

it('does not reopen a page after leaving the detail', async () => {
  mockActions.switchTradeInstrument.mockImplementationOnce(async () => {
    mockNavigation.isFocused.mockReturnValue(false);
    return true;
  });
  const { result } = renderHook(usePerpGoToTrade);
  await act(async () => {
    await result.current.goToTrade('BTC');
  });
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});

it('keeps errors visible and allows a retry', async () => {
  const error = new Error('switch failed');
  mockActions.switchTradeInstrument.mockRejectedValueOnce(error);
  const { result } = renderHook(usePerpGoToTrade);
  await act(async () => {
    await result.current.goToTrade('BTC');
  });
  expect(mockToast).toHaveBeenCalledWith(error);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(mockNavigation.popStack).not.toHaveBeenCalled();
  expect(result.current.switchingAsset).toBe(false);
  await act(async () => {
    await result.current.goToTrade('BTC');
  });
  expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
});

it.each(['pro', 'desktop'])(
  'preserves %s close-and-switch behavior',
  async (mode) => {
    if (mode === 'pro') mockSettings.mobileTradingMode = 'pro';
    else {
      mockPlatform.isNative = false;
      mockMedia.gtMd = true;
    }
    const { result } = renderHook(usePerpGoToTrade);
    await act(async () => {
      await result.current.goToTrade('BTC');
    });
    expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
    expect(mockActions.switchTradeInstrument).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  },
);

it('routes historical spot trades to professional mode', async () => {
  const { result } = renderHook(usePerpGoToTrade);
  await act(async () => {
    await result.current.goToTrade('@107');
  });
  expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
    mode: 'spot',
    coin: '@107',
    subscriptionRecoveryProof: mockProof,
  });
  const update = mockSetSettings.mock.calls[0][0] as (settings: {
    mobileTradingMode: string;
    other: boolean;
  }) => { mobileTradingMode: string; other: boolean };
  expect(update({ mobileTradingMode: 'simple', other: true })).toEqual({
    mobileTradingMode: 'pro',
    other: true,
  });
  expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});

it('opens the selector for a simple portfolio entry without a specified contract', async () => {
  const { result } = renderHook(usePerpGoToTrade);
  await act(async () => {
    await result.current.goToTrade();
  });
  expect(mockNavigation.replace).toHaveBeenCalledWith(
    EModalPerpRoutes.MobileTokenSelector,
  );
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
});

it('returns to the professional panel from portfolio', async () => {
  mockSettings.mobileTradingMode = 'pro';
  const { result } = renderHook(usePerpGoToTrade);
  await act(async () => {
    await result.current.goToTrade();
  });
  expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
});
