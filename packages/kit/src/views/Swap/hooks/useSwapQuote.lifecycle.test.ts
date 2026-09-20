import { act, renderHook } from '@testing-library/react-native';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';

import { useSwapActions } from '../../../states/jotai/contexts/swap';

import { useSwapQuote } from './useSwapQuote';

import type { EventEmitter } from 'events';

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      getCurrentRoute: (() => {
        const getCurrentRoute = jest.fn();
        (
          globalThis as unknown as {
            __swapQuoteGetCurrentRouteMock: typeof getCurrentRoute;
          }
        ).__swapQuoteGetCurrentRouteMock = getCurrentRoute;
        return getCurrentRoute;
      })(),
    },
  },
  useIsOverlayPage: () => false,
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: jest.fn(() => true),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter: MockEventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return {
    EAppEventBusNames: {
      SwapQuoteEvent: 'SwapQuoteEvent',
      SwapApprovingSuccess: 'SwapApprovingSuccess',
    },
    appEventBus: new MockEventEmitter(),
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [{}],
  useSettingsPersistAtom: () => [{}],
}));

jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: () => ({}),
}));

jest.mock('./useSwapPro', () => ({
  useSwapProInputToken: jest.fn(),
  useSwapProToToken: jest.fn(),
}));

jest.mock('./useSwapState', () => ({
  useSwapSlippagePercentageModeInfo: () => ({ slippageItem: { key: 'auto' } }),
}));

jest.mock('../../../states/jotai/contexts/swap', () => {
  const setter = jest.fn();
  const actions = {
    current: {
      quoteAction: jest.fn(),
      cleanQuoteInterval: jest.fn(),
      quoteEventHandler: jest.fn(),
      syncNetworksSort: jest.fn(),
      closeQuoteEvent: jest.fn(),
      swapTypeSwitchAction: jest.fn(),
    },
  };
  return {
    useSwapActions: () => actions,
    useSwapQuoteActionLockAtom: () => [{}, setter],
    useSwapTypeSwitchAtom: () => ['swap'],
    useSwapStockExecutionTokenSyncIdAtom: () => [undefined],
    useSwapSelectFromTokenAtom: () => [undefined, setter],
    useSwapSelectToTokenAtom: () => [undefined, setter],
    useSwapSelectTokenNetworkAtom: () => [undefined],
    useSwapSlippageDialogOpeningAtom: () => [{ status: false }],
    useSwapApproveAllowanceSelectOpenAtom: () => [false],
    useSwapFromTokenAmountAtom: () => [{ value: '', isInput: true }, setter],
    useSwapToTokenAmountAtom: () => [{ value: '', isInput: false }, setter],
    useSwapQuoteListAtom: () => [[], setter],
    useSwapManualSelectQuoteProvidersAtom: () => [[], setter],
    useSwapQuoteEventTotalCountAtom: () => [{ count: 0 }, setter],
    useSwapQuoteFetchingAtom: () => [false, setter],
    useSwapShouldRefreshQuoteAtom: () => [false],
  };
});

const eventBus = appEventBus as unknown as EventEmitter;
const routeMock = (
  globalThis as unknown as {
    __swapQuoteGetCurrentRouteMock: jest.Mock;
  }
).__swapQuoteGetCurrentRouteMock;
const focusMock = jest.mocked(useRouteIsFocused);

describe.each([false, true])(
  'Swap route quote lifecycle (native=%s)',
  (isNative) => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      Object.assign(platformEnv, { isNative });
      focusMock.mockReturnValue(true);
      routeMock.mockReturnValue({ key: 'swap', name: 'Swap' });
    });

    afterEach(() => {
      eventBus.removeAllListeners();
      jest.useRealTimers();
    });

    it('removes listeners when a focused route is unmounted without a blur', () => {
      const { result, unmount } = renderHook(() => {
        useSwapQuote({ isMarketEmbeddedSwap: true });
        return useSwapActions().current.quoteEventHandler;
      });
      const quoteEventHandler = result.current;
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      expect(
        eventBus.listenerCount(EAppEventBusNames.SwapApprovingSuccess),
      ).toBe(1);

      unmount();
      act(() => jest.runAllTimers());

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      expect(
        eventBus.listenerCount(EAppEventBusNames.SwapApprovingSuccess),
      ).toBe(0);
      eventBus.emit(EAppEventBusNames.SwapQuoteEvent, { type: 'test' });
      expect(quoteEventHandler).not.toHaveBeenCalled();
    });

    it('keeps receiving quotes while the provider picker blurs the swap route', () => {
      const { result, rerender } = renderHook(() => {
        useSwapQuote({ isMarketEmbeddedSwap: true });
        return useSwapActions().current.quoteEventHandler;
      });
      routeMock.mockReturnValue({
        key: 'provider-picker',
        name: EModalSwapRoutes.SwapProviderSelect,
      });
      focusMock.mockReturnValue(false);
      rerender(undefined);
      act(() => jest.runAllTimers());

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      expect(
        eventBus.listenerCount(EAppEventBusNames.SwapApprovingSuccess),
      ).toBe(1);
      eventBus.emit(EAppEventBusNames.SwapQuoteEvent, { type: 'test' });
      expect(result.current).toHaveBeenCalledTimes(1);
    });
  },
);
