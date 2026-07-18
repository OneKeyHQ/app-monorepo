/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getSwapTokenIdentityKey } from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import type {
  ISwapApproveTransaction,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockMarketQuoteGateStatus,
  type ISwapStockMarketQuoteGate,
} from '../../../states/jotai/contexts/swap/stockMarketQuoteGate';

import { useSwapQuote } from './useSwapQuote';

import type { ISwapQuoteSessionState } from '../../../states/jotai/contexts/swap/quoteSessionV2';

const mockQuoteDispatchedFromAmounts: string[] = [];
const mockQuoteAction = jest.fn();
const mockCloseQuoteEvent = jest.fn();
const mockQuoteEventHandlerV2 = jest.fn();
const mockInvalidateQuoteIntent = jest.fn();
const mockSwapTypeSwitchAction = jest.fn(() => Promise.resolve());
const mockSyncNetworksSort = jest.fn(() => Promise.resolve());
const mockSetManualProvider = jest.fn();
const mockSetFromToken = jest.fn();
const mockSetToToken = jest.fn();
const mockSetFromAmount = jest.fn();
const mockSetToAmount = jest.fn();
const mockSetQuoteFetching = jest.fn();
const mockAnalytics = jest.fn();
let mockSenderAddress = '0xsender';
let mockToAddressInfoReady = true;
let mockToAddress: string | undefined = '0xreceiver';
let mockCurrentSelectNetwork: { networkId: string } | undefined;
let mockStockMarketQuoteGate: ISwapStockMarketQuoteGate | undefined;
let mockIsFocused = true;

let mockTabFocusCallback:
  | ((isFocused: boolean, isHiddenByOverlay: boolean) => void)
  | undefined;

const mockFromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  decimals: 18,
  symbol: 'FROM',
};
const mockToToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  decimals: 6,
  symbol: 'TO',
};
const mockStockToken: ISwapToken = {
  ...mockToToken,
  contractAddress: '0xstock',
  isStock: true,
  symbol: 'STOCK',
};
const mockOtherToken: ISwapToken = {
  ...mockFromToken,
  contractAddress: '0xother',
  symbol: 'OTHER',
};
let mockSelectedFromToken: ISwapToken = mockFromToken;
let mockSelectedToToken: ISwapToken = mockToToken;

let mockState: {
  dialog: { status: boolean; flag?: string };
  fromAmount: { value: string; isInput: boolean };
  protocol: ESwapTabSwitchType;
  session: ISwapQuoteSessionState;
  slippage: { key: ESwapSlippageSegmentKey; value: number };
  toAmount: { value: string; isInput: boolean };
};

jest.mock('@onekeyhq/components', () => ({
  useIsOverlayPage: () => false,
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [
    {
      swapEnableRecipientAddress: false,
      swapSlippagePercentageMode: mockState.slippage.key,
    },
  ],
  useSettingsPersistAtom: () => [{ swapBatchApproveAndSwap: false }],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    swap: {
      swapQuote: {
        swapQuote: (...args: unknown[]) => {
          mockAnalytics(...args);
        },
      },
    },
  },
}));

jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: (
    _route: unknown,
    callback: (isFocused: boolean, isHiddenByOverlay: boolean) => void,
  ) => {
    mockTabFocusCallback = callback;
  },
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorStorageInitDoneAtom: () => [true],
  useIsAccountSelectorActiveAccountInitDone: () => true,
}));

jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: {
      closeQuoteEvent: mockCloseQuoteEvent,
      invalidateQuoteIntent: mockInvalidateQuoteIntent,
      quoteAction: mockQuoteAction,
      quoteEventHandlerV2: mockQuoteEventHandlerV2,
      swapTypeSwitchAction: mockSwapTypeSwitchAction,
      syncNetworksSort: mockSyncNetworksSort,
    },
  }),
  useSwapApproveAllowanceSelectOpenAtom: () => [false],
  useSwapFromTokenAmountAtom: () => [mockState.fromAmount, mockSetFromAmount],
  useSwapInitialSelectedTokensSyncedAtom: () => [true],
  useSwapLimitExpirationTimeAtom: () => [{ value: '3600' }],
  useSwapLimitPartiallyFillAtom: () => [{ value: true }],
  useSwapLimitPriceUseRateAtom: () => [{}],
  useSwapManualSelectQuoteProvidersAtom: () => [
    undefined,
    mockSetManualProvider,
  ],
  useSwapQuoteActionLockAtom: () => [{}],
  useSwapQuoteEventTotalCountAtom: () => [{ count: 0 }],
  useSwapQuoteFetchingAtom: () => [false, mockSetQuoteFetching],
  useSwapQuoteListAtom: () => [[]],
  useSwapQuoteSessionStateAtom: () => [mockState.session],
  useSwapSelectFromTokenAtom: () => [mockSelectedFromToken, mockSetFromToken],
  useSwapSelectToTokenAtom: () => [mockSelectedToToken, mockSetToToken],
  useSwapSelectTokenNetworkAtom: () => [mockCurrentSelectNetwork],
  useSwapShouldRefreshQuoteAtom: () => [false],
  useSwapSlippageDialogOpeningAtom: () => [mockState.dialog],
  useSwapStockExecutionTokenSyncIdAtom: () => [0],
  useSwapStockMarketQuoteGateAtom: () => [mockStockMarketQuoteGate],
  useSwapToAnotherAccountAddressAtom: () => [undefined],
  useSwapToTokenAmountAtom: () => [mockState.toAmount, mockSetToAmount],
  useSwapTypeSwitchAtom: () => [mockState.protocol],
}));

jest.mock('../utils/swapStockAnalytics', () => ({
  getStockTradeAnalyticsPayload: () => ({}),
  getSwapAnalyticsCategory: () => 'Limit',
}));

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: (direction: string) =>
    direction === 'from'
      ? {
          address: mockSenderAddress,
          networkId: mockSelectedFromToken.networkId,
          isAddressInfoReady: true,
          accountInfo: {
            account: { id: 'account-1' },
            wallet: { type: 'hd' },
          },
        }
      : {
          address: mockToAddressInfoReady ? mockToAddress : undefined,
          networkId: mockSelectedToToken.networkId,
          isAddressInfoReady: mockToAddressInfoReady,
          accountInfo: {
            account: { id: 'account-1' },
          },
        },
}));

jest.mock('./useSwapPro', () => ({
  useSwapProInputToken: () => undefined,
  useSwapProToToken: () => undefined,
}));

jest.mock('./useSwapState', () => ({
  useSwapSlippagePercentageModeInfo: () => ({
    slippageItem: mockState.slippage,
  }),
}));

function buildApproval(
  overrides: Partial<ISwapApproveTransaction> = {},
): ISwapApproveTransaction {
  return {
    amount: mockState.fromAmount.value,
    fromToken: mockFromToken,
    protocol: EProtocolOfExchange.LIMIT,
    provider: 'provider-a',
    providerName: 'Provider A',
    spenderAddress: '0xspender',
    status: ESwapApproveTransactionStatus.PENDING,
    swapType: ESwapTabSwitchType.LIMIT,
    toToken: mockToToken,
    useAddress: '0xsender',
    ...overrides,
  };
}

describe('useSwapQuote semantic re-quote ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuoteDispatchedFromAmounts.length = 0;
    mockTabFocusCallback = undefined;
    mockSenderAddress = '0xsender';
    mockToAddressInfoReady = true;
    mockToAddress = '0xreceiver';
    mockCurrentSelectNetwork = undefined;
    mockStockMarketQuoteGate = undefined;
    mockIsFocused = true;
    mockSelectedFromToken = mockFromToken;
    mockSelectedToToken = mockToToken;
    mockState = {
      dialog: { status: false },
      fromAmount: { value: '5', isInput: false },
      protocol: ESwapTabSwitchType.LIMIT,
      session: {
        intentRevision: 1,
        lastSequence: 0,
        phase: 'idle',
      },
      slippage: { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
      toAmount: { value: '10', isInput: true },
    };
    mockQuoteAction.mockImplementation(() => {
      mockQuoteDispatchedFromAmounts.push(mockState.fromAmount.value);
    });
  });

  afterEach(() => {
    act(() => {
      mockTabFocusCallback?.(false, false);
    });
  });

  it('keeps LIMIT BUY kind when the slippage dialog saves', () => {
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();

    mockState.dialog = { status: false, flag: 'save' };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.BUY,
      undefined,
      expect.anything(),
    );
  });

  it('does not dispatch a Stock quote when the amount changes while the owned market is closed', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    mockStockMarketQuoteGate = {
      ownerStockKey: getSwapTokenIdentityKey(mockStockToken),
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();
    mockInvalidateQuoteIntent.mockClear();

    mockState.fromAmount = { value: '7', isInput: true };
    rerender();

    expect(mockQuoteAction).not.toHaveBeenCalled();
    expect(mockInvalidateQuoteIntent).toHaveBeenCalledWith({
      isPending: false,
    });
  });

  it('dispatches exactly one Stock quote with the latest amount and saved slippage when Closed becomes Allowed', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    const ownerStockKey = getSwapTokenIdentityKey(mockStockToken);
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();

    mockState.fromAmount = { value: '7', isInput: true };
    mockState.slippage = {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1.25,
    };
    mockState.dialog = { status: false, flag: 'save' };
    rerender();
    expect(mockQuoteAction).not.toHaveBeenCalled();

    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledWith(
      mockState.slippage,
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      undefined,
      expect.anything(),
    );
    expect(mockQuoteDispatchedFromAmounts).toEqual(['7']);
  });

  it('dispatches exactly one Stock quote when gate, amount, and saved slippage change in the same resume commit', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    const ownerStockKey = getSwapTokenIdentityKey(mockStockToken);
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();

    mockState.fromAmount = { value: '7', isInput: true };
    mockState.slippage = {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1.25,
    };
    mockState.dialog = { status: false, flag: 'save' };
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledWith(
      mockState.slippage,
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      undefined,
      expect.anything(),
    );
    expect(mockQuoteDispatchedFromAmounts).toEqual(['7']);
  });

  it('waits for focus and dispatches the latest Stock quote once when the market reopens behind an overlay', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    const ownerStockKey = getSwapTokenIdentityKey(mockStockToken);
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();
    mockQuoteDispatchedFromAmounts.length = 0;

    mockIsFocused = false;
    rerender();
    act(() => {
      mockTabFocusCallback?.(true, true);
    });

    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    rerender();
    mockState.fromAmount = { value: '7', isInput: true };
    mockState.slippage = {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1.25,
    };
    rerender();
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    rerender();

    expect(mockQuoteAction).not.toHaveBeenCalled();

    // The tab-focus signal can arrive before route focus updates.
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockIsFocused = true;
    rerender();
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledWith(
      mockState.slippage,
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      undefined,
      expect.anything(),
    );
    expect(mockQuoteDispatchedFromAmounts).toEqual(['7']);
  });

  it('does not duplicate a Stock quote when route focus recovers before the tab-focus callback', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    const ownerStockKey = getSwapTokenIdentityKey(mockStockToken);
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();
    mockQuoteDispatchedFromAmounts.length = 0;

    mockIsFocused = false;
    rerender();
    act(() => {
      mockTabFocusCallback?.(true, true);
    });
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    rerender();
    expect(mockQuoteAction).not.toHaveBeenCalled();

    mockIsFocused = true;
    rerender();
    act(() => {
      mockTabFocusCallback?.(true, false);
      mockTabFocusCallback?.(true, false);
    });
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteDispatchedFromAmounts).toEqual(['5']);
  });

  it('dispatches exactly one Stock quote when slippage is saved while the owned market is allowed', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    mockStockMarketQuoteGate = {
      ownerStockKey: getSwapTokenIdentityKey(mockStockToken),
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();
    mockQuoteDispatchedFromAmounts.length = 0;

    // Saving updates settings before the dialog's async close callback fires.
    mockState.dialog = { status: true };
    mockState.slippage = {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1.25,
    };
    rerender();
    expect(mockQuoteAction).not.toHaveBeenCalled();

    mockState.dialog = { status: false, flag: 'save' };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledWith(
      mockState.slippage,
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      undefined,
      expect.anything(),
    );
    expect(mockQuoteDispatchedFromAmounts).toEqual(['5']);
  });

  it('does not dispatch a Stock quote for an allowed gate owned by another stock', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '10', isInput: false };
    mockSelectedToToken = mockStockToken;
    mockStockMarketQuoteGate = {
      ownerStockKey: `${mockStockToken.networkId}:0x1234:token`,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();

    mockState.fromAmount = { value: '7', isInput: true };
    rerender();

    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it('keeps a Stock sell paused while Closed, then quotes only the latest amount once when its owner becomes Allowed', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '', isInput: false };
    mockSelectedFromToken = mockStockToken;
    mockSelectedToToken = mockToToken;
    const ownerStockKey = getSwapTokenIdentityKey(mockStockToken);
    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();
    mockQuoteDispatchedFromAmounts.length = 0;

    mockState.fromAmount = { value: '7', isInput: true };
    rerender();

    expect(mockQuoteAction).not.toHaveBeenCalled();

    mockState.fromAmount = { value: '9', isInput: true };
    rerender();
    expect(mockQuoteAction).not.toHaveBeenCalled();

    mockStockMarketQuoteGate = {
      ownerStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      undefined,
      expect.anything(),
    );
    expect(mockQuoteDispatchedFromAmounts).toEqual(['9']);
  });

  it('does not quote a Stock sell when an Allowed gate belongs to another stock', () => {
    mockState.protocol = ESwapTabSwitchType.STOCK;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '', isInput: false };
    mockSelectedFromToken = mockStockToken;
    mockSelectedToToken = mockToToken;
    mockStockMarketQuoteGate = {
      ownerStockKey: `${getSwapTokenIdentityKey(mockStockToken)}:stale`,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();

    mockState.fromAmount = { value: '7', isInput: true };
    rerender();

    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it('keeps ordinary ERC20 Swap quoting even when a Closed Stock gate remains in the atom', () => {
    mockState.protocol = ESwapTabSwitchType.SWAP;
    mockState.fromAmount = { value: '5', isInput: true };
    mockState.toAmount = { value: '', isInput: false };
    mockSelectedFromToken = mockFromToken;
    mockSelectedToToken = mockToToken;
    mockStockMarketQuoteGate = {
      ownerStockKey: getSwapTokenIdentityKey(mockStockToken),
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();
    mockQuoteDispatchedFromAmounts.length = 0;

    mockState.fromAmount = { value: '7', isInput: true };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
      undefined,
      expect.anything(),
    );
    expect(mockQuoteDispatchedFromAmounts).toEqual(['7']);
  });

  it('keeps LIMIT BUY kind when settings change slippage mode', () => {
    const { rerender } = renderHook(() => useSwapQuote());
    mockQuoteAction.mockClear();

    mockState.slippage = {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1.25,
    };
    rerender();

    expect(mockQuoteAction).toHaveBeenCalledWith(
      mockState.slippage,
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.BUY,
      undefined,
      expect.anything(),
    );
  });

  it('re-enters with LIMIT BUY even when the invalidated quote is missing', () => {
    renderHook(() => useSwapQuote());
    expect(mockTabFocusCallback).toBeDefined();
    mockQuoteAction.mockClear();

    act(() => {
      mockTabFocusCallback?.(false, false);
      mockTabFocusCallback?.(true, false);
    });

    expect(mockQuoteAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      ESwapQuoteKind.BUY,
      undefined,
      expect.anything(),
    );
  });

  it('does not let a late approval from another pair pin its provider', () => {
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({ fromToken: mockOtherToken }),
      });
    });

    expect(mockSetManualProvider).not.toHaveBeenCalled();
  });

  it('invalidates and clears a manual provider when native identity changes to an incomplete token', () => {
    mockSelectedFromToken = {
      ...mockFromToken,
      contractAddress: '',
      isNative: true,
    };
    const { rerender } = renderHook(() => useSwapQuote());
    mockInvalidateQuoteIntent.mockClear();
    mockSetManualProvider.mockClear();

    mockSelectedFromToken = {
      ...mockSelectedFromToken,
      isNative: false,
      symbol: 'INCOMPLETE',
    };
    rerender();

    expect(mockInvalidateQuoteIntent).toHaveBeenCalledWith({
      isPending: false,
    });
    expect(mockSetManualProvider).toHaveBeenCalledWith(undefined);
  });

  it('does not let a native approval match an incomplete empty-address token', () => {
    mockSelectedFromToken = {
      ...mockFromToken,
      contractAddress: '',
      isNative: false,
      symbol: 'INCOMPLETE',
    };
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockQuoteAction.mockClear();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({
          fromToken: {
            ...mockSelectedFromToken,
            isNative: true,
            symbol: 'ETH',
          },
        }),
      });
    });

    expect(mockSetManualProvider).not.toHaveBeenCalled();
    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it('does not let a late approval from another account pin or requote the current owner', () => {
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockQuoteAction.mockClear();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({ useAddress: '0xold-sender' }),
      });
    });

    expect(mockSetManualProvider).not.toHaveBeenCalled();
    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it('does not let a late approval from another swap tab pin or requote the current surface', () => {
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockQuoteAction.mockClear();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({
          protocol: EProtocolOfExchange.SWAP,
          swapType: ESwapTabSwitchType.SWAP,
        }),
      });
    });

    expect(mockSetManualProvider).not.toHaveBeenCalled();
    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it.each(['to-address', 'network-selector'] as const)(
    'does not pin or requote an approval while %s readiness is pending',
    (blocker) => {
      if (blocker === 'to-address') {
        mockToAddressInfoReady = false;
      } else {
        mockCurrentSelectNetwork = { networkId: mockFromToken.networkId };
      }
      renderHook(() => useSwapQuote());
      act(() => {
        mockTabFocusCallback?.(true, false);
      });
      mockSetManualProvider.mockClear();
      mockQuoteAction.mockClear();

      act(() => {
        appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
          approvedSwapInfo: buildApproval(),
        });
      });

      expect(mockSetManualProvider).not.toHaveBeenCalled();
      expect(mockQuoteAction).not.toHaveBeenCalled();
    },
  );

  it('fails closed when an active target owner settles without an address', () => {
    mockToAddress = undefined;
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockQuoteAction.mockClear();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval(),
      });
    });

    expect(mockSetManualProvider).not.toHaveBeenCalled();
    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it('restores enableFilled data while readiness is pending without pinning its provider', async () => {
    mockToAddressInfoReady = false;
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockSetFromToken.mockClear();
    mockSetToToken.mockClear();
    mockSetFromAmount.mockClear();
    mockQuoteAction.mockClear();

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({ amount: '6' }),
        enableFilled: true,
      });
      await Promise.resolve();
    });

    expect(mockSetFromToken).toHaveBeenCalledWith(mockFromToken);
    expect(mockSetToToken).toHaveBeenCalledWith(mockToToken);
    expect(mockSetFromAmount).toHaveBeenCalledWith({
      value: '6',
      isInput: true,
    });
    expect(mockSetManualProvider).not.toHaveBeenCalled();
    expect(mockQuoteAction).not.toHaveBeenCalled();
  });

  it('accepts approval owner casing differences on EVM networks', () => {
    mockSenderAddress = '0xAbC';
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockQuoteAction.mockClear();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({ useAddress: '0xabc' }),
      });
    });

    expect(mockSetManualProvider).toHaveBeenCalledTimes(1);
    expect(mockQuoteAction).toHaveBeenCalledTimes(1);
  });

  it('restores an enableFilled approval without pinning another account provider', async () => {
    renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockSetFromToken.mockClear();
    mockSetToToken.mockClear();

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({
          amount: '6',
          useAddress: '0xold-sender',
        }),
        enableFilled: true,
      });
      await Promise.resolve();
    });

    expect(mockSetFromToken).toHaveBeenCalledWith(mockFromToken);
    expect(mockSetToToken).toHaveBeenCalledWith(mockToToken);
    expect(mockSetManualProvider).not.toHaveBeenCalled();
  });

  it('does not pin an enableFilled provider when the account changes during restore', async () => {
    let resolveNetworkSort!: () => void;
    const { rerender } = renderHook(() => useSwapQuote());
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    mockSetManualProvider.mockClear();
    mockSyncNetworksSort.mockClear();
    mockSyncNetworksSort.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveNetworkSort = resolve;
        }),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
        approvedSwapInfo: buildApproval({ amount: '6' }),
        enableFilled: true,
      });
    });
    expect(mockSyncNetworksSort).toHaveBeenCalledTimes(1);

    mockSenderAddress = '0xnew-sender';
    rerender();
    await act(async () => {
      resolveNetworkSort();
      await Promise.resolve();
    });

    expect(mockSetManualProvider).not.toHaveBeenCalled();
  });
});
