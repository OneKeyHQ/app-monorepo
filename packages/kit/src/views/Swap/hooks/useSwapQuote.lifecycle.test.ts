import { act, renderHook } from '@testing-library/react-native';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapApproveTransaction,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import {
  useSwapActions,
  useSwapManualSelectQuoteProvidersAtom,
} from '../../../states/jotai/contexts/swap';

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

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [
    (globalThis as unknown as { __swapQuoteLocked: boolean }).__swapQuoteLocked,
  ],
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
  EJotaiContextStoreNames: { swap: 'swap', marketSwap: 'marketSwap' },
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
  useDebounce: jest.fn((value: unknown) => value),
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
  const setProviderIntent = jest.fn();
  const fetchingSetter = jest.fn();
  const amounts = globalThis as typeof globalThis & IQuoteAmountFixture;
  const setFromAmount = (update: IQuoteAmountUpdate) => {
    amounts.__swapQuoteFromAmount =
      typeof update === 'function'
        ? update(amounts.__swapQuoteFromAmount)
        : update;
  };
  const setToAmount = (update: IQuoteAmountUpdate) => {
    amounts.__swapQuoteToAmount =
      typeof update === 'function'
        ? update(amounts.__swapQuoteToAmount)
        : update;
  };
  (
    globalThis as unknown as {
      __swapQuoteFetchingSetter: typeof fetchingSetter;
    }
  ).__swapQuoteFetchingSetter = fetchingSetter;
  const actions = {
    current: {
      quoteAction: jest.fn(),
      resumeQuoteAction: jest.fn(),
      replayDeferredQuote: jest.fn(),
      cleanQuoteInterval: jest.fn(),
      quoteEventHandler: jest.fn(),
      advanceSwapTabPrefillEditRevision: jest.fn(() => 1),
      restoreApprovedSwapDraft: jest.fn(),
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
    useSwapLimitPriceUseRateAtom: () => [{}],
    useSwapQuoteActionLockAtom: () => [{ quoteRequestId: 'quote-1' }, setter],
    useSwapTypeSwitchAtom: () => [
      (globalThis as unknown as { __swapQuoteType?: string }).__swapQuoteType ??
        'swap',
    ],
    useSwapStockExecutionTokenSyncIdAtom: () => [undefined],
    useSwapProTradeTypeAtom: () => [
      (globalThis as unknown as { __swapQuoteProTradeType?: string })
        .__swapQuoteProTradeType ?? 'limit',
    ],
    useSwapProInputAmountAtom: () => [
      (globalThis as unknown as { __swapQuoteProAmount?: string })
        .__swapQuoteProAmount ?? '',
    ],
    useSwapSelectFromTokenAtom: () => [
      (globalThis as unknown as { __swapQuoteFromToken?: ISwapToken })
        .__swapQuoteFromToken,
      setter,
    ],
    useSwapSelectToTokenAtom: () => [
      (globalThis as unknown as { __swapQuoteToToken?: ISwapToken })
        .__swapQuoteToToken,
      setter,
    ],
    useSwapSelectTokenNetworkAtom: () => [undefined],
    useSwapSelectedTokenMultiplierStatusAtom: () => [
      (globalThis as unknown as { __swapQuoteMultiplierStatus?: string })
        .__swapQuoteMultiplierStatus ?? 'ready',
    ],
    useSwapSlippageDialogOpeningAtom: () => [{ status: false }],
    useSwapApproveAllowanceSelectOpenAtom: () => [false],
    useSwapFromTokenAmountAtom: () => [
      amounts.__swapQuoteFromAmount,
      setFromAmount,
    ],
    useSwapToTokenAmountAtom: () => [amounts.__swapQuoteToAmount, setToAmount],
    useSwapQuoteListAtom: () => [[], setter],
    useSwapManualSelectQuoteProvidersAtom: () => [undefined, setProviderIntent],
    useSwapQuoteEventTotalCountAtom: () => [{ count: 0 }, setter],
    useSwapQuoteFetchingAtom: () => [false, fetchingSetter],
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
const lockFixture = globalThis as unknown as { __swapQuoteLocked: boolean };
type IQuoteAmount = { value: string; isInput: boolean };
type IQuoteAmountUpdate =
  | IQuoteAmount
  | ((amount: IQuoteAmount) => IQuoteAmount);
type IQuoteAmountFixture = {
  __swapQuoteFromAmount: IQuoteAmount;
  __swapQuoteToAmount: IQuoteAmount;
};
const amountFixture = globalThis as typeof globalThis & IQuoteAmountFixture;
const typeFixture = globalThis as typeof globalThis & {
  __swapQuoteType?: string;
};
const tokenFixture = globalThis as unknown as {
  __swapQuoteFromToken?: ISwapToken;
  __swapQuoteToToken?: ISwapToken;
  __swapQuoteMultiplierStatus?: 'checking' | 'ready';
};
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
        quoteAction: jest.Mock;
        closeQuoteEvent: jest.Mock;
        quoteEventHandler: jest.Mock;
      };
    };
  }
).__swapQuoteLifecycleActions;

const approvedTrade: ISwapApproveTransaction = {
  fromToken: {
    networkId: 'evm--1',
    contractAddress: 'from-token',
    symbol: 'FROM',
    decimals: 6,
  },
  toToken: {
    networkId: 'evm--1',
    contractAddress: 'to-token',
    symbol: 'TO',
    decimals: 6,
  },
  protocol: EProtocolOfExchange.SWAP,
  swapType: ESwapTabSwitchType.SWAP,
  provider: 'provider',
  providerName: 'Provider',
  useAddress: 'account-address',
  spenderAddress: 'spender-address',
  amount: '7',
  status: ESwapApproveTransactionStatus.SUCCESS,
};
const approvedProviderIntent = {
  type: 'manual-provider',
  info: {
    provider: approvedTrade.provider,
    providerName: approvedTrade.providerName,
  },
};

describe.each([false, true])(
  'Swap route quote lifecycle (native=%s)',
  (isNative) => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      jest.mocked(useDebounce).mockImplementation((value) => value);
      Object.assign(platformEnv, { isNative });
      Object.assign(addressInfo, { address: undefined, networkId: undefined });
      focusMock.mockReturnValue(true);
      lockFixture.__swapQuoteLocked = false;
      amountFixture.__swapQuoteFromAmount = { value: '', isInput: true };
      amountFixture.__swapQuoteToAmount = { value: '', isInput: false };
      tokenFixture.__swapQuoteFromToken = undefined;
      tokenFixture.__swapQuoteToToken = undefined;
      tokenFixture.__swapQuoteMultiplierStatus = 'ready';
      (globalThis as unknown as { __swapQuoteType?: string }).__swapQuoteType =
        'swap';
      (
        globalThis as unknown as { __swapQuoteProTradeType?: string }
      ).__swapQuoteProTradeType = 'limit';
      (
        globalThis as unknown as { __swapQuoteProAmount?: string }
      ).__swapQuoteProAmount = '';
      routeMock.mockReturnValue({ key: 'swap', name: 'Swap' });
    });

    it.each(
      isNative
        ? [ESwapQuoteKind.SELL]
        : [ESwapQuoteKind.SELL, ESwapQuoteKind.BUY],
    )(
      'keeps the cleared %s input empty when Stock exit restored a draft during the debounce window',
      (kind) => {
        jest
          .mocked(useDebounce)
          .mockImplementation(
            jest.requireActual<typeof import('../../../hooks/useDebounce')>(
              '../../../hooks/useDebounce',
            ).useDebounce,
          );
        const networkId = 'evm--1';
        const emptyAmount = { value: '', isInput: false };
        const isSell = kind === ESwapQuoteKind.SELL;
        const amountKey = isSell
          ? '__swapQuoteFromAmount'
          : '__swapQuoteToAmount';
        const tokenKey = isSell ? '__swapQuoteFromToken' : '__swapQuoteToToken';
        Object.assign(addressInfo, { address: 'account-address', networkId });
        tokenFixture.__swapQuoteFromToken = {
          networkId,
          contractAddress: 'from-token',
          symbol: 'FROM',
          decimals: 18,
        };
        tokenFixture.__swapQuoteToToken = {
          networkId,
          contractAddress: 'to-token',
          symbol: 'TO',
          decimals: 18,
        };
        amountFixture.__swapQuoteFromAmount = emptyAmount;
        amountFixture.__swapQuoteToAmount = emptyAmount;
        typeFixture.__swapQuoteType = 'stock';
        const { result, rerender, unmount } = renderHook(() => {
          useSwapQuote();
          return useSwapActions().current;
        });
        const quoteAction = jest.mocked(result.current.quoteAction);
        const requestQuote = jest.fn();
        quoteAction.mockImplementation((...args) => {
          const amount = amountFixture[amountKey].value;
          if (args[5] === kind && Number(amount) > 0) {
            requestQuote(amount);
          }
          return Promise.resolve();
        });

        typeFixture.__swapQuoteType = isSell ? 'swap' : 'limit';
        amountFixture[amountKey] = { value: '1.12345678', isInput: true };
        rerender(undefined);
        expect(requestQuote).toHaveBeenCalledWith('1.12345678');
        requestQuote.mockClear();

        act(() => jest.advanceTimersByTime(100));
        tokenFixture[tokenKey] = {
          networkId,
          contractAddress: 'prefilled-token',
          decimals: 6,
          symbol: 'PREFILL',
        };
        amountFixture[amountKey] = emptyAmount;
        rerender(undefined);

        expect(amountFixture[amountKey]).toEqual(emptyAmount);
        expect(requestQuote).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(500));
        expect(amountFixture[amountKey]).toEqual(emptyAmount);
        expect(requestQuote).not.toHaveBeenCalled();

        amountFixture[amountKey] = { value: '0.25', isInput: true };
        rerender(undefined);
        expect(requestQuote).toHaveBeenCalledWith('0.25');
        unmount();
      },
    );

    afterEach(() => {
      lifecycleActions.current.quoteAction.mockReset();
      eventBus.removeAllListeners();
      jest.useRealTimers();
    });

    it.each([true, false])(
      'claims the form before waiting for the mode switch and restores only while visible (visible=%s)',
      async (remainsVisible) => {
        typeFixture.__swapQuoteType = ESwapTabSwitchType.STOCK;
        const { result, rerender } = renderHook(() => {
          useSwapQuote();
          return useSwapActions().current;
        });
        const { advanceSwapTabPrefillEditRevision, restoreApprovedSwapDraft } =
          result.current;
        let resolveSwitch: () => void = () => undefined;
        jest.mocked(result.current.swapTypeSwitchAction).mockReturnValueOnce(
          new Promise<undefined>((resolve) => {
            resolveSwitch = () => resolve(undefined);
          }),
        );

        act(() => {
          appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
            approvedSwapInfo: approvedTrade,
            enableFilled: true,
          });
        });

        expect(advanceSwapTabPrefillEditRevision).toHaveBeenCalledTimes(1);
        expect(result.current.swapTypeSwitchAction).toHaveBeenCalledWith(
          ESwapTabSwitchType.SWAP,
        );
        expect(restoreApprovedSwapDraft).not.toHaveBeenCalled();
        if (!remainsVisible) {
          focusMock.mockReturnValue(false);
          rerender(undefined);
        }
        await act(async () => resolveSwitch());

        if (remainsVisible) {
          expect(restoreApprovedSwapDraft).toHaveBeenCalledWith({
            editRevision: 1,
            providerIntent: approvedProviderIntent,
            fromToken: approvedTrade.fromToken,
            toToken: approvedTrade.toToken,
            direction: ESwapDirectionType.FROM,
            amount: approvedTrade.amount,
          });
        } else {
          expect(restoreApprovedSwapDraft).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      { enableFilled: false, swapType: ESwapTabSwitchType.SWAP },
      { enableFilled: true, swapType: ESwapTabSwitchType.SWAP },
      { enableFilled: true, swapType: ESwapTabSwitchType.BRIDGE },
    ])(
      'refreshes a matching approved draft and only claims it on an explicit restore (explicit=$enableFilled, type=$swapType)',
      ({ enableFilled, swapType }) => {
        const approval = {
          ...approvedTrade,
          swapType,
          toToken:
            swapType === ESwapTabSwitchType.BRIDGE
              ? { ...approvedTrade.toToken, networkId: 'evm--137' }
              : approvedTrade.toToken,
        };
        tokenFixture.__swapQuoteFromToken = approval.fromToken;
        tokenFixture.__swapQuoteToToken = approval.toToken;
        amountFixture.__swapQuoteFromAmount = {
          value: approval.amount,
          isInput: true,
        };
        const { result } = renderHook(() => {
          useSwapQuote();
          const [, setProviderIntent] = useSwapManualSelectQuoteProvidersAtom();
          return { ...useSwapActions().current, setProviderIntent };
        });
        const { quoteAction, setProviderIntent } = result.current;
        jest.mocked(quoteAction).mockClear();

        act(() => {
          appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
            approvedSwapInfo: approval,
            enableFilled,
          });
        });

        expect(quoteAction).toHaveBeenCalledTimes(1);
        expect(setProviderIntent).toHaveBeenCalledTimes(1);
        expect(setProviderIntent).toHaveBeenCalledWith(approvedProviderIntent);
        expect(
          result.current.advanceSwapTabPrefillEditRevision,
        ).toHaveBeenCalledTimes(enableFilled ? 1 : 0);
        expect(result.current.swapTypeSwitchAction).not.toHaveBeenCalled();
        expect(result.current.restoreApprovedSwapDraft).not.toHaveBeenCalled();
      },
    );

    if (!isNative) {
      it.each([false, true])(
        'handles a matching pair and amount in another mode only on explicit approval return (explicit=%s)',
        async (enableFilled) => {
          typeFixture.__swapQuoteType = ESwapTabSwitchType.LIMIT;
          tokenFixture.__swapQuoteFromToken = approvedTrade.fromToken;
          tokenFixture.__swapQuoteToToken = approvedTrade.toToken;
          amountFixture.__swapQuoteFromAmount = {
            value: approvedTrade.amount,
            isInput: true,
          };
          const { result } = renderHook(() => {
            useSwapQuote();
            const [, setProviderIntent] =
              useSwapManualSelectQuoteProvidersAtom();
            return { ...useSwapActions().current, setProviderIntent };
          });
          const {
            advanceSwapTabPrefillEditRevision,
            quoteAction,
            restoreApprovedSwapDraft,
            setProviderIntent,
            swapTypeSwitchAction,
          } = result.current;
          jest.mocked(quoteAction).mockClear();

          await act(async () => {
            appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
              approvedSwapInfo: approvedTrade,
              enableFilled,
            });
          });

          expect(quoteAction).not.toHaveBeenCalled();
          expect(setProviderIntent).not.toHaveBeenCalled();
          if (enableFilled) {
            expect(advanceSwapTabPrefillEditRevision).toHaveBeenCalledTimes(1);
            expect(swapTypeSwitchAction).toHaveBeenCalledWith(
              ESwapTabSwitchType.SWAP,
            );
            expect(restoreApprovedSwapDraft).toHaveBeenCalledWith({
              editRevision: 1,
              providerIntent: approvedProviderIntent,
              fromToken: approvedTrade.fromToken,
              toToken: approvedTrade.toToken,
              direction: ESwapDirectionType.FROM,
              amount: approvedTrade.amount,
            });
          } else {
            expect(advanceSwapTabPrefillEditRevision).not.toHaveBeenCalled();
            expect(swapTypeSwitchAction).not.toHaveBeenCalled();
            expect(restoreApprovedSwapDraft).not.toHaveBeenCalled();
          }
        },
      );

      it.each([ESwapQuoteKind.BUY, ESwapQuoteKind.SELL])(
        'restores the approved %s input when the matching value is currently derived',
        (kind) => {
          const isBuy = kind === ESwapQuoteKind.BUY;
          const approval = {
            ...approvedTrade,
            protocol: EProtocolOfExchange.LIMIT,
            swapType: ESwapTabSwitchType.LIMIT,
            kind,
            toAmount: '14',
          };
          typeFixture.__swapQuoteType = approval.swapType;
          tokenFixture.__swapQuoteFromToken = approval.fromToken;
          tokenFixture.__swapQuoteToToken = approval.toToken;
          amountFixture.__swapQuoteFromAmount = {
            value: approval.amount,
            isInput: isBuy,
          };
          amountFixture.__swapQuoteToAmount = {
            value: approval.toAmount,
            isInput: !isBuy,
          };
          const { result } = renderHook(() => {
            useSwapQuote();
            return useSwapActions().current;
          });
          const {
            quoteAction,
            restoreApprovedSwapDraft,
            swapTypeSwitchAction,
          } = result.current;
          jest.mocked(quoteAction).mockClear();

          act(() => {
            appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
              approvedSwapInfo: approval,
              enableFilled: true,
            });
          });

          expect(quoteAction).not.toHaveBeenCalled();
          expect(swapTypeSwitchAction).not.toHaveBeenCalled();
          expect(restoreApprovedSwapDraft).toHaveBeenCalledWith({
            editRevision: 1,
            providerIntent: approvedProviderIntent,
            fromToken: approval.fromToken,
            toToken: approval.toToken,
            direction: isBuy ? ESwapDirectionType.TO : ESwapDirectionType.FROM,
            amount: isBuy ? approval.toAmount : approval.amount,
          });
        },
      );
    }

    it('does not request a new quote when only multiplier verification finishes', () => {
      const networkId = 'sol--101';
      Object.assign(addressInfo, { address: 'account-address', networkId });
      tokenFixture.__swapQuoteFromToken = {
        networkId,
        contractAddress: 'scaled-mint',
        decimals: 8,
        symbol: 'SCALED',
        balanceMultiplier: '2',
      };
      tokenFixture.__swapQuoteToToken = {
        networkId,
        contractAddress: '',
        decimals: 9,
        symbol: 'SOL',
        isNative: true,
      };
      amountFixture.__swapQuoteFromAmount = { value: '12', isInput: true };
      tokenFixture.__swapQuoteMultiplierStatus = 'checking';
      const { result, rerender, unmount } = renderHook(() => {
        useSwapQuote();
        return useSwapActions().current;
      });
      jest.mocked(result.current.quoteAction).mockClear();
      jest.mocked(result.current.replayDeferredQuote).mockClear();
      tokenFixture.__swapQuoteMultiplierStatus = 'ready';
      rerender(undefined);
      expect(result.current.quoteAction).not.toHaveBeenCalled();
      expect(result.current.replayDeferredQuote).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('restores amount effects on same-page unlock without a router callback', () => {
      const { result, rerender, unmount } = renderHook(() => {
        useSwapQuote();
        return useSwapActions().current;
      });
      act(() => getTabFocusCallback()(true, false));
      lockFixture.__swapQuoteLocked = true;
      focusMock.mockReturnValue(false);
      rerender(undefined);
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      lockFixture.__swapQuoteLocked = false;
      focusMock.mockReturnValue(true);
      rerender(undefined);
      jest.mocked(result.current.quoteAction).mockClear();
      amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
      rerender(undefined);
      expect(result.current.quoteAction).toHaveBeenCalledTimes(1);
      unmount();
    });

    it.each([false, true])(
      'pauses immediately on lock and resumes preserved input once (picker=%s)',
      (picker) => {
        amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
        const { result, rerender, unmount } = renderHook(() => {
          useSwapQuote();
          return useSwapActions().current;
        });
        act(() => getTabFocusCallback()(true, false));
        if (picker) {
          routeMock.mockReturnValue({
            name: EModalSwapRoutes.SwapProviderSelect,
            params: { storeName: 'swap' },
          });
          act(() => getTabFocusCallback()(false, true));
        }
        jest.mocked(result.current.closeQuoteEvent).mockClear();
        jest.mocked(result.current.resumeQuoteAction).mockClear();
        lockFixture.__swapQuoteLocked = true;
        focusMock.mockReturnValue(false);
        rerender(undefined);
        expect(result.current.closeQuoteEvent).toHaveBeenCalledWith('quote-1');
        expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(
          0,
        );
        act(() => jest.runAllTimers());
        expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(
          0,
        );
        lockFixture.__swapQuoteLocked = false;
        focusMock.mockReturnValue(!picker);
        rerender(undefined);
        act(() => getTabFocusCallback()(!picker, picker));
        expect(result.current.resumeQuoteAction).toHaveBeenCalledTimes(1);
        expect(result.current.resumeQuoteAction).toHaveBeenCalledWith(
          expect.objectContaining({ pausedQuoteRequestId: 'quote-1' }),
        );
        expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(
          2,
        );
        unmount();
      },
    );

    it('starts while locked and restores input effects after the first unlock', () => {
      lockFixture.__swapQuoteLocked = true;
      const { result, rerender, unmount } = renderHook(() => {
        useSwapQuote();
        return useSwapActions().current;
      });
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      lockFixture.__swapQuoteLocked = false;
      rerender(undefined);
      jest.mocked(result.current.quoteAction).mockClear();
      amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
      rerender(undefined);
      expect(result.current.quoteAction).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('does not clear Stock fetching when the provider picker blurs the route', () => {
      (globalThis as unknown as { __swapQuoteType?: string }).__swapQuoteType =
        'stock';
      const { rerender, unmount } = renderHook(() =>
        useSwapQuote({ isMarketEmbeddedSwap: true }),
      );
      const fetchingSetter = (
        globalThis as unknown as { __swapQuoteFetchingSetter: jest.Mock }
      ).__swapQuoteFetchingSetter;
      fetchingSetter.mockClear();
      routeMock.mockReturnValue({
        name: EModalSwapRoutes.SwapProviderSelect,
        params: { storeName: 'swap' },
      });
      focusMock.mockReturnValue(false);
      rerender(undefined);
      act(() => jest.runAllTimers());
      expect(fetchingSetter).not.toHaveBeenCalledWith(false);
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      unmount();
    });

    it.each(['changed', 'round-trip', 'same-value'])(
      'waits for trailing Stock input before resuming once (scenario=%s)',
      (scenario) => {
        jest
          .mocked(useDebounce)
          .mockImplementation(
            jest.requireActual<typeof import('../../../hooks/useDebounce')>(
              '../../../hooks/useDebounce',
            ).useDebounce,
          );
        (
          globalThis as unknown as { __swapQuoteType?: string }
        ).__swapQuoteType = 'stock';
        amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
        const { result, rerender, unmount } = renderHook(() => {
          useSwapQuote();
          return useSwapActions().current;
        });
        act(() => getTabFocusCallback()(true, false));
        jest.mocked(result.current.quoteAction).mockClear();
        jest.mocked(result.current.resumeQuoteAction).mockClear();
        amountFixture.__swapQuoteFromAmount = {
          value: scenario === 'same-value' ? '100' : '101',
          isInput: true,
        };
        rerender(undefined);
        if (scenario === 'round-trip') {
          amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
          rerender(undefined);
        }
        lockFixture.__swapQuoteLocked = true;
        rerender(undefined);
        lockFixture.__swapQuoteLocked = false;
        rerender(undefined);
        expect(result.current.resumeQuoteAction).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(500));
        expect(result.current.resumeQuoteAction).toHaveBeenCalledTimes(1);
        expect(result.current.quoteAction).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(500));
        expect(result.current.resumeQuoteAction).toHaveBeenCalledTimes(1);
        expect(result.current.quoteAction).not.toHaveBeenCalled();
        unmount();
      },
    );

    it('keeps the existing quote through a destination published after blur', () => {
      amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
      const { result, unmount } = renderHook(() => {
        useSwapQuote();
        return useSwapActions().current;
      });
      act(() => getTabFocusCallback()(true, false));
      jest.mocked(result.current.closeQuoteEvent).mockClear();
      act(() => getTabFocusCallback()(false, true));
      routeMock.mockReturnValue({
        name: EModalSwapRoutes.SwapProviderSelect,
        params: { storeName: 'swap' },
      });
      act(() => jest.runAllTimers());
      expect(result.current.closeQuoteEvent).not.toHaveBeenCalled();
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(2);
      unmount();
    });

    it('does not resume a hidden Swap owner for another store provider picker', () => {
      amountFixture.__swapQuoteFromAmount = { value: '100', isInput: true };
      const { result, unmount } = renderHook(() => {
        useSwapQuote();
        return useSwapActions().current;
      });
      act(() => getTabFocusCallback()(true, false));
      act(() => getTabFocusCallback()(false, false));
      act(() => jest.runAllTimers());
      jest.mocked(result.current.resumeQuoteAction).mockClear();
      routeMock.mockReturnValue({
        name: EModalSwapRoutes.SwapProviderSelect,
        params: { storeName: 'marketSwap' },
      });
      act(() => getTabFocusCallback()(false, true));
      act(() => jest.runAllTimers());
      expect(result.current.resumeQuoteAction).not.toHaveBeenCalled();
      expect(eventBus.listenerCount(EAppEventBusNames.SwapQuoteEvent)).toBe(0);
      unmount();
    });

    it('resumes native Pro market input even when generic Swap amounts are empty', () => {
      if (!isNative) return;
      (globalThis as unknown as { __swapQuoteType?: string }).__swapQuoteType =
        'limit';
      (
        globalThis as unknown as { __swapQuoteProTradeType?: string }
      ).__swapQuoteProTradeType = 'market';
      (
        globalThis as unknown as { __swapQuoteProAmount?: string }
      ).__swapQuoteProAmount = '1';
      const { result, rerender, unmount } = renderHook(() => {
        useSwapQuote();
        return useSwapActions().current;
      });
      act(() => getTabFocusCallback()(true, false));
      jest.mocked(result.current.resumeQuoteAction).mockClear();
      lockFixture.__swapQuoteLocked = true;
      rerender(undefined);
      lockFixture.__swapQuoteLocked = false;
      rerender(undefined);
      expect(result.current.resumeQuoteAction).toHaveBeenCalledTimes(1);
      unmount();
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
        params: { storeName: 'swap' },
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
        params: { storeName: 'swap' },
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
        params: { storeName: 'swap' },
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
        params: { storeName: 'swap' },
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
