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
  default: jest.fn((_routeName, callback) => {
    (
      globalThis as unknown as {
        __swapQuoteTabFocusCallback: (
          isFocus: boolean,
          isHiddenModel: boolean,
        ) => void;
      }
    ).__swapQuoteTabFocusCallback = callback;
  }),
}));

jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: () =>
    (
      globalThis as unknown as {
        __swapQuoteAddressInfo: { address?: string; networkId?: string };
      }
    ).__swapQuoteAddressInfo,
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
  (
    globalThis as unknown as {
      __swapQuoteLifecycleActions: typeof actions;
    }
  ).__swapQuoteLifecycleActions = actions;
  return {
    useSwapActions: () => actions,
    useSwapQuoteActionLockAtom: () => [{ quoteRequestId: 'quote-1' }, setter],
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
const addressInfo: { address?: string; networkId?: string } = ((
  globalThis as unknown as {
    __swapQuoteAddressInfo: { address?: string; networkId?: string };
  }
).__swapQuoteAddressInfo = {});
const getTabFocusCallback = () =>
  (
    globalThis as unknown as {
      __swapQuoteTabFocusCallback: (
        isFocus: boolean,
        isHiddenModel: boolean,
      ) => void;
    }
  ).__swapQuoteTabFocusCallback;
const lifecycleActions = (
  globalThis as unknown as {
    __swapQuoteLifecycleActions: {
      current: {
        closeQuoteEvent: jest.Mock;
        quoteEventHandler: jest.Mock;
      };
    };
  }
).__swapQuoteLifecycleActions;

describe.each([false, true])(
  'Swap route quote lifecycle (native=%s)',
  (isNative) => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      Object.assign(platformEnv, { isNative });
      Object.assign(addressInfo, { address: undefined, networkId: undefined });
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

    it('cleans listeners when the provider picker route is also unmounted', () => {
      routeMock.mockReturnValue({
        key: 'provider-picker',
        name: EModalSwapRoutes.SwapProviderSelect,
      });
      const { unmount } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: true }),
      );

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      unmount();

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      expect(
        eventBus.listenerCount(EAppEventBusNames.SwapApprovingSuccess),
      ).toBe(0);
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

    it('receives quotes while the native provider picker route settles after focus loss', () => {
      if (!isNative) {
        return;
      }

      const { result, rerender } = renderHook(() => {
        useSwapQuote({ isMarketEmbeddedSwap: true });
        return useSwapActions().current.quoteEventHandler;
      });
      focusMock.mockReturnValue(false);
      rerender(undefined);

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      expect(
        eventBus.listenerCount(EAppEventBusNames.SwapApprovingSuccess),
      ).toBe(1);
      eventBus.emit(EAppEventBusNames.SwapQuoteEvent, { type: 'gap' });
      expect(result.current).toHaveBeenCalledTimes(1);

      routeMock.mockReturnValue({
        key: 'provider-picker',
        name: EModalSwapRoutes.SwapProviderSelect,
      });
      act(() => jest.runAllTimers());

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      expect(
        eventBus.listenerCount(EAppEventBusNames.SwapApprovingSuccess),
      ).toBe(1);
      eventBus.emit(EAppEventBusNames.SwapQuoteEvent, { type: 'test' });
      expect(result.current).toHaveBeenCalledTimes(2);
    });

    it('pauses the quote before an unfocused route unmounts', () => {
      if (!isNative) {
        return;
      }

      const { unmount, rerender } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: true }),
      );
      focusMock.mockReturnValue(false);
      rerender(undefined);
      unmount();
      expect(lifecycleActions.current.closeQuoteEvent).toHaveBeenCalledWith(
        'quote-1',
      );
      const closeCount =
        lifecycleActions.current.closeQuoteEvent.mock.calls.length;
      act(() => jest.runAllTimers());
      expect(lifecycleActions.current.closeQuoteEvent).toHaveBeenCalledTimes(
        closeCount,
      );
    });

    it('drives tab visibility through the real focus listener', () => {
      const { unmount } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: false }),
      );
      act(() => getTabFocusCallback()(true, false));
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);

      act(() => getTabFocusCallback()(false, true));
      if (isNative) {
        expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(
          2,
        );
      }
      act(() => jest.runAllTimers());

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      unmount();
    });

    it('flushes hidden-tab cleanup before native unmount completes', () => {
      if (!isNative) {
        return;
      }

      const { unmount } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: false }),
      );
      act(() => getTabFocusCallback()(true, false));
      act(() => getTabFocusCallback()(false, true));
      unmount();

      expect(lifecycleActions.current.closeQuoteEvent).toHaveBeenCalledWith(
        'quote-1',
      );
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      const closeCount =
        lifecycleActions.current.closeQuoteEvent.mock.calls.length;
      act(() => jest.runAllTimers());
      expect(lifecycleActions.current.closeQuoteEvent).toHaveBeenCalledTimes(
        closeCount,
      );
    });

    it('keeps quote listeners flat when the quote address changes', () => {
      if (!isNative) {
        return;
      }

      addressInfo.address = '0x1';
      const { rerender, unmount } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: true }),
      );
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);

      addressInfo.address = '0x2';
      rerender(undefined);
      addressInfo.address = '0x3';
      rerender(undefined);
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);

      unmount();
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
    });

    it('keeps tab quotes alive for the provider picker and cancels stale hides', () => {
      const { unmount } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: false }),
      );
      act(() => getTabFocusCallback()(true, false));
      routeMock.mockReturnValue({
        key: 'provider-picker',
        name: EModalSwapRoutes.SwapProviderSelect,
      });
      act(() => getTabFocusCallback()(false, true));
      act(() => jest.runAllTimers());

      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      eventBus.emit(EAppEventBusNames.SwapQuoteEvent, { type: 'picker' });
      expect(lifecycleActions.current.quoteEventHandler).toHaveBeenCalledTimes(
        1,
      );

      routeMock.mockReturnValue({ key: 'swap', name: 'Swap' });
      act(() => getTabFocusCallback()(true, false));
      act(() => getTabFocusCallback()(false, true));
      act(() => getTabFocusCallback()(true, false));
      act(() => jest.runAllTimers());
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      unmount();
    });
  },
);
