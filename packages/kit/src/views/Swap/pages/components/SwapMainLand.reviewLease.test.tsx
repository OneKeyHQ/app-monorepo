/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import SwapMainLand from './SwapMainLand';

type IDeferred = {
  promise: Promise<void>;
  reject: (error: Error) => void;
  resolve: () => void;
};

type IDialogOptions = {
  renderContent?: ReactNode;
};

type IPrimitiveProps = {
  children?: ReactNode | ((state: { open: boolean }) => ReactNode);
  testID?: string;
};

const mockAbortEstimateFee = jest.fn();
const mockBuildSwapReviewState = jest.fn<unknown, unknown[]>();
const mockInModalDialogShow = jest.fn();
const mockInTabDialogShow = jest.fn();
const mockPreSwapStepsStart = jest.fn<Promise<void>, []>();
const mockResolveSwapReviewExecutionGuardState = jest.fn<
  { blocked: boolean },
  unknown[]
>(() => ({
  blocked: false,
}));
const mockResolveSwapReviewRiskCheckInput = jest.fn<unknown, unknown[]>();
const mockSetSwapBuildTxFetching = jest.fn();
const mockSetSwapReviewExecutionSnapshot = jest.fn();
const mockSetSwapShouldRefreshQuote = jest.fn();
const mockSetSwapSteps = jest.fn();

const mockFromToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'FROM',
  decimals: 6,
};
const mockToToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'TO',
  decimals: 6,
};
const mockQuoteResult = {
  fromAmount: '1',
  fromTokenInfo: mockFromToken,
  info: { provider: 'provider-1', providerName: 'Provider' },
  protocol: 'Swap',
  toAmount: '2',
  toTokenInfo: mockToToken,
};
const mockExecutionSnapshot = {
  fromToken: mockFromToken,
  fromTokenAmount: '1',
  quoteResult: mockQuoteResult,
  reviewRevision: 'review-r1',
  slippage: '0.5',
  swapType: 'swap',
  toToken: mockToToken,
  toTokenAmount: '2',
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children, testID }: IPrimitiveProps) =>
    React.createElement(
      'div',
      { 'data-testid': testID },
      typeof children === 'function' ? children({ open: false }) : children,
    );
  return {
    __esModule: true,
    Dialog: { confirm: jest.fn() },
    EPageType: { modal: 'modal' },
    Page: { Container: Primitive },
    Toast: { error: jest.fn(), message: jest.fn() },
    YStack: Primitive,
    useInModalDialog: () => ({ show: mockInModalDialogShow }),
    useInTabDialog: () => ({ show: mockInTabDialogShow }),
    useMedia: () => ({ gtLg: false }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceGas: {
      abortEstimateFee: (...args: unknown[]) => {
        mockAbortEstimateFee(...args);
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: IPrimitiveProps) => children,
}));

jest.mock('@onekeyhq/kit/src/components/LazyPageContainer', () => ({
  LazyPageContainer: ({ children }: IPrimitiveProps) => children,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useCustomRpcAvailability', () => ({
  useCustomRpcAvailability: () => ({ isCustomRpcUnavailable: false }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: { clearTokenDetail: jest.fn() },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useRateDifferenceAtom: () => [undefined],
  useSwapActions: () => ({
    current: {
      quoteAction: jest.fn(),
      selectFromToken: jest.fn(),
      selectToToken: jest.fn(),
      setSwapProSelectToken: jest.fn(),
    },
  }),
  useSwapAlertsAtom: () => [{ quoteId: '', states: [] }],
  useSwapBuildTxFetchingAtom: () => [false, mockSetSwapBuildTxFetching],
  useSwapFromTokenAmountAtom: () => [{ isInput: true, value: '1' }, jest.fn()],
  useSwapLimitExpirationTimeAtom: () => [{ value: 'day' }],
  useSwapLimitPartiallyFillAtom: () => [{ value: false }],
  useSwapLimitPriceFromAmountAtom: () => [''],
  useSwapLimitPriceToAmountAtom: () => [''],
  useSwapLimitPriceUseRateAtom: () => [undefined],
  useSwapNativeTokenReserveGasAtom: () => [[]],
  useSwapNetworksAtom: () => [[]],
  useSwapProDirectionAtom: () => ['sell'],
  useSwapProInputAmountAtom: () => ['', jest.fn()],
  useSwapProSelectTokenAtom: () => [undefined],
  useSwapProTradeTypeAtom: () => ['market'],
  useSwapQuoteActionLockAtom: () => [
    { actionLock: false, limitSettingsKey: '' },
  ],
  useSwapQuoteCommittedStateAtom: () => [
    {
      committedAt: 1,
      intentFingerprint: 'fingerprint-1',
      requestId: 'request-1',
    },
  ],
  useSwapQuoteCurrentSelectAtom: () => [mockQuoteResult],
  useSwapQuoteEventCompletedAtom: () => [true],
  useSwapQuoteIntervalCountAtom: () => [0, jest.fn()],
  useSwapQuoteSessionStateAtom: () => [
    {
      activeSession: {
        fingerprint: 'fingerprint-1',
        intentRevision: 1,
        requestId: 'request-1',
      },
      phase: 'settled',
    },
  ],
  useSwapReviewExecutionSnapshotAtom: () => [
    undefined,
    mockSetSwapReviewExecutionSnapshot,
  ],
  useSwapSelectFromTokenAtom: () => [mockFromToken],
  useSwapSelectToTokenAtom: () => [mockToToken, jest.fn()],
  useSwapSelectedFromTokenBalanceAtom: () => ['10'],
  useSwapShouldRefreshQuoteAtom: () => [false, mockSetSwapShouldRefreshQuote],
  useSwapSpeedQuoteResultAtom: () => [undefined],
  useSwapStepsAtom: () => [
    {
      preSwapData: {},
      quoteResult: mockQuoteResult,
      steps: [{ type: 'swap' }],
    },
    mockSetSwapSteps,
  ],
  useSwapStockMarketQuoteGateAtom: () => [undefined],
  useSwapToTokenAmountAtom: () => [{ isInput: false, value: '2' }],
  useSwapTypeSwitchAtom: () => ['swap'],
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteCommittedState',
  () => ({ isSwapQuoteCommittedActiveCandidate: () => true }),
);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress', () => ({
  isSwapPreBuildTransportSettled: () => true,
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteSemanticIntent',
  () => ({
    buildSwapQuoteLimitSemanticSettings: () => undefined,
    buildSwapQuoteLimitSemanticSettingsKey: () => '',
    getSwapQuoteKindForCurrentInput: () => 'swap',
  }),
);

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/swap/stockMarketQuoteGate',
  () => ({ isSwapStockMarketQuoteBlocked: () => false }),
);

jest.mock('@onekeyhq/kit/src/utils/validateAmountInput', () => ({
  validateAmountInput: () => true,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2',
  () => ({
    MarketWatchListProviderMirrorV2: ({ children }: IPrimitiveProps) =>
      children,
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: {
    marketWatchListV2: 'marketWatchListV2',
    swap: 'swap',
    swapModal: 'swapModal',
  },
  useCurrencyPersistAtom: () => [{ currencyMap: { usd: { unit: '$' } } }],
  useInAppNotificationAtom: () => [{ swapRecentTokenPairs: [] }],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: { id: 'usd', symbol: '$' },
      swapBatchApproveAndSwap: false,
    },
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => ({
  useSwapProJumpTokenAtom: () => [{ marketPresetToken: undefined }],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    swap: { selectToken: { selectToken: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isNativeIOS: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'review-r1',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock(
  '../../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSettings',
  () => ({
    EMarketPresetTradeSide: { BUY: 'buy', SELL: 'sell' },
    shouldShowMarketPresetReviewCustomNetworkFeeOption: () => false,
  }),
);

jest.mock(
  '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings',
  () => ({
    useMarketPresetSettings: () => ({
      enabled: false,
      isLoading: false,
    }),
  }),
);

jest.mock('../../hooks/useMarketPresetSwapOverridesEffect', () => ({
  useMarketPresetSwapOverridesEffect: jest.fn(),
}));

jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({
    accountInfo: {
      account: { id: 'account-1' },
      indexedAccount: { id: 'indexed-account-1' },
      wallet: { id: 'wallet-1', type: 'hd' },
    },
    address: '0xsender',
    networkId: 'evm--1',
  }),
}));

jest.mock('../../hooks/useSwapBuiltTx', () => ({
  useSwapBuildTx: () => ({
    preSwapBeforeStepActions: jest.fn(),
    preSwapStepsStart: mockPreSwapStepsStart,
  }),
}));

jest.mock('../../hooks/useSwapGlobal', () => ({
  useSwapInit: () => ({ fetchLoading: false }),
}));

jest.mock('../../hooks/useSwapPro', () => ({
  useSwapProAccount: () => ({
    accountScope: '',
    accountStatus: '',
    result: undefined,
  }),
  useSwapProErrorAlert: jest.fn(),
  useSwapProInit: () => ({ networkList: [] }),
  useSwapProInputToken: () => undefined,
  useSwapProToToken: () => undefined,
  useSwapProTokenInit: () => ({
    balanceLoading: false,
    hasEnoughBalance: true,
    isLoading: false,
    isMEV: false,
    speedConfig: undefined,
    speedConfigReady: true,
    supportSpeedSwap: false,
  }),
}));

jest.mock('../../hooks/useSwapQuote', () => ({ useSwapQuote: jest.fn() }));

jest.mock('../../hooks/useSwapState', () => ({
  useSwapQuoteEventFetching: () => false,
  useSwapQuoteLoading: () => false,
  useSwapQuoteProgressState: () => ({ displayQuote: undefined }),
  useSwapSlippagePercentageModeInfo: () => ({
    slippageItem: { value: '0.5' },
  }),
}));

jest.mock('../../utils/buildSwapReviewState', () => ({
  buildSwapReviewState: (...args: unknown[]) =>
    mockBuildSwapReviewState(...args),
}));

jest.mock('../../utils/swapBalanceUtils', () => ({
  getSwapSafeInputBalanceAmount: () => undefined,
}));

jest.mock('../../utils/swapExecutionSnapshotGuard', () => ({
  resolveSwapReviewExecutionGuardState: (...args: unknown[]) =>
    mockResolveSwapReviewExecutionGuardState(...args),
  resolveSwapReviewRiskCheckInput: (...args: unknown[]) =>
    mockResolveSwapReviewRiskCheckInput(...args),
}));

jest.mock('../../utils/swapRateDifferenceUtils', () => ({
  buildSwapRateDifference: () => undefined,
}));

jest.mock('../../utils/swapStockAnalytics', () => ({
  getSwapAnalyticsTokenListType: () => 'swap',
}));

jest.mock('../../utils/swapTypeUtils', () => ({
  getSwapExecutionTypeFromQuoteResult: () => 'swap',
}));

jest.mock('../SwapProviderMirror', () => ({
  SwapProviderMirror: ({ children }: IPrimitiveProps) => children,
}));

jest.mock('./PreSwapDialogContent', () => ({
  __esModule: true,
  default: ({ onConfirm }: { onConfirm: () => void }) => (
    <button data-testid="review-confirm" onClick={onConfirm} type="button">
      confirm
    </button>
  ),
}));

jest.mock('./SwapHeaderContainer', () => () => null);
jest.mock('./SwapInitialStockTypeGate', () => ({
  SwapInitialStockTypeGate: ({ children }: IPrimitiveProps) => children,
}));
jest.mock('./SwapOldSwapBridgeLimitContainer', () => ({
  __esModule: true,
  default: ({ onPreSwap }: { onPreSwap: () => void }) => (
    <button data-testid="open-review" onClick={onPreSwap} type="button">
      review
    </button>
  ),
}));
jest.mock('./SwapProContainer', () => () => null);
jest.mock('./SwapStockDesktopContainer', () => ({
  SwapStockDesktopContainer: () => null,
  SwapStockMobileContainer: () => null,
}));
jest.mock('./SwapSwapMbContainer', () => () => null);

jest.mock('./useSwapReviewDialogLifecycle', () => ({
  useSwapReviewDialogLifecycle: () => ({
    scheduleReview: (
      _reviewRevision: string,
      showReviewDialog: (handlers: {
        onClose: () => void;
        onDone: () => void;
      }) => unknown,
    ) =>
      showReviewDialog({
        onClose: jest.fn(),
        onDone: jest.fn(),
      }),
  }),
}));

function createDeferred(): IDeferred {
  let reject!: IDeferred['reject'];
  let resolve!: IDeferred['resolve'];
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

async function settleDeferred(
  deferred: IDeferred,
  outcome: 'resolve' | 'reject',
) {
  await act(async () => {
    if (outcome === 'resolve') {
      deferred.resolve();
    } else {
      deferred.reject(new Error('expected review failure'));
    }
    await Promise.resolve();
  });
}

describe('SwapMainLand review confirm lease wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildSwapReviewState.mockReturnValue({
      executionSnapshot: mockExecutionSnapshot,
      preSwapData: {},
      quoteResult: mockQuoteResult,
      steps: [{ type: 'swap' }],
    });
    mockResolveSwapReviewRiskCheckInput.mockReturnValue({
      fromTokenAmount: '1',
      quoteResult: mockQuoteResult,
      reviewRevision: 'review-r1',
      toTokenAmount: '2',
    });
  });

  it.each(['resolve', 'reject'] as const)(
    'blocks a second confirm while the same review is pending and unlocks after %s',
    async (outcome) => {
      const firstAttempt = createDeferred();
      const retryAttempt = createDeferred();
      mockPreSwapStepsStart
        .mockReturnValueOnce(firstAttempt.promise)
        .mockReturnValueOnce(retryAttempt.promise);

      render(<SwapMainLand />);
      fireEvent.click(screen.getByTestId('open-review'));

      const dialogOptions = mockInTabDialogShow.mock.calls[0]?.[0] as
        | IDialogOptions
        | undefined;
      expect(dialogOptions?.renderContent).toBeTruthy();
      render(dialogOptions?.renderContent);

      fireEvent.click(screen.getByTestId('review-confirm'));
      fireEvent.click(screen.getByTestId('review-confirm'));

      expect(mockResolveSwapReviewRiskCheckInput).toHaveBeenCalledTimes(1);
      expect(mockPreSwapStepsStart).toHaveBeenCalledTimes(1);

      await settleDeferred(firstAttempt, outcome);

      fireEvent.click(screen.getByTestId('review-confirm'));

      expect(mockResolveSwapReviewRiskCheckInput).toHaveBeenCalledTimes(2);
      expect(mockPreSwapStepsStart).toHaveBeenCalledTimes(2);

      await settleDeferred(retryAttempt, 'resolve');
    },
  );
});
