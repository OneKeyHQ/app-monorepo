/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapRateDifferenceUnit,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapStepsAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapBuildTx } from './useSwapBuiltTx';

const mockFetchBuildTx = jest.fn<Promise<IFetchBuildTxResponse>, unknown[]>();
const mockPrepareSwapBuildTxContext = jest.fn(
  async ({
    accountId,
    protocol,
  }: {
    accountId: string;
    protocol: EProtocolOfExchange;
  }) => ({
    accountId,
    protocol,
    referralBuildTxParams: {},
    walletTypeHeader: { 'X-OneKey-Wallet-Type': 'hd' },
  }),
);
const mockPrepareUnsignedTx = jest.fn<
  Promise<unknown>,
  [{ transfersInfo?: Array<{ to: string }>; approveInfo?: unknown }]
>();
const mockEstimateFee = jest.fn<Promise<unknown>, unknown[]>();
const mockBatchEstimateFee = jest.fn<Promise<unknown>, unknown[]>();
const mockFetchAccountDetails = jest.fn(async () => ({ nonce: 3 }));
const mockFetchSwapTokenDetails = jest.fn(async () => [
  { balanceParsed: '100' },
]);
const mockGetVaultSettings = jest.fn<
  Promise<{ supportBatchEstimateFee?: Record<string, boolean> }>,
  []
>(async () => ({}));
const mockNavigateTxConfirm = jest.fn();
const mockNavigateMessageConfirm = jest.fn();

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  isNative: true,
  symbol: 'ETH',
  decimals: 18,
  price: '1000',
  currency: 'usd',
};
const toToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0x0000000000000000000000000000000000000001',
  symbol: 'USDT',
  decimals: 18,
  price: '1',
  currency: 'usd',
};
const quote: IFetchQuoteResult = {
  quoteId: 'review-repro-quote',
  protocol: EProtocolOfExchange.SWAP,
  kind: ESwapQuoteKind.SELL,
  info: { provider: 'HiFiSwap', providerName: 'HiFi' },
  fromAmount: '0.1',
  toAmount: '120',
  instantRate: '1200',
  fromTokenInfo: fromToken,
  toTokenInfo: toToken,
  fee: { percentageFee: 0.3 },
  quoteResultCtx: {},
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<typeof import('@onekeyhq/components')>(
    '@onekeyhq/components',
  ),
  useIsOverlayPage: () => true,
  rootNavigationRef: { current: null },
  Toast: { error: jest.fn() },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms'),
  useSettingsPersistAtom: () => [
    {
      currencyInfo: { id: 'usd', symbol: '$' },
      isFirstTimeSwap: false,
      useGasAccountByDefault: false,
    },
    jest.fn(),
  ],
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useSettingsAtom: () => [{}, jest.fn()],
  useInAppNotificationAtom: () => [{}, jest.fn()],
}));
jest.mock('../../../hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    navigationToTxConfirm: mockNavigateTxConfirm,
    navigationToMessageConfirm: mockNavigateMessageConfirm,
  }),
}));
jest.mock('./useSwapPro', () => ({
  useSwapBuildTxInfo: () => ({
    currentQuoteRes: quote,
    fromSelectToken: fromToken,
    toSelectToken: toToken,
  }),
  useSwapProAccount: () => ({}),
}));
jest.mock('./useSwapState', () => ({
  useSwapSlippagePercentageModeInfo: () => ({
    slippageItem: { key: 'auto', value: 1 },
  }),
  useSwapActionState: () => ({ approveUnLimit: false }),
}));
jest.mock('./useSwapTxHistory', () => ({
  useSwapTxHistoryActions: () => ({ generateSwapHistoryItem: jest.fn() }),
}));
jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: (direction: string) => ({
    address: '0x0000000000000000000000000000000000000002',
    networkId: direction === 'from' ? 'evm--1' : 'evm--56',
    accountInfo: {
      account: { id: 'hd-repro--0' },
      indexedAccount: { id: 'hd-repro-index-0' },
      wallet: { type: 'hd' },
    },
  }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: { getNativeTokenAddress: async () => '' },
    serviceSwap: {
      fetchSwapTokenDetails: () => mockFetchSwapTokenDetails(),
      prepareSwapBuildTxContext: (params: {
        accountId: string;
        protocol: EProtocolOfExchange;
      }) => mockPrepareSwapBuildTxContext(params),
      fetchBuildTx: (...args: unknown[]) => mockFetchBuildTx(...args),
      swapRecentTokenPairsUpdate: async () => undefined,
    },
    serviceSend: {
      prepareSendConfirmUnsignedTx: (
        params: Parameters<typeof mockPrepareUnsignedTx>[0],
      ) => mockPrepareUnsignedTx(params),
    },
    serviceAccountProfile: {
      fetchAccountDetails: () => mockFetchAccountDetails(),
    },
    serviceNetwork: { getVaultSettings: () => mockGetVaultSettings() },
    serviceGas: {
      buildEstimateFeeParams: async ({
        encodedTx,
      }: {
        encodedTx: unknown;
      }) => ({ encodedTx }),
      estimateFee: (...args: unknown[]) => mockEstimateFee(...args),
      batchEstimateFee: (...args: unknown[]) => mockBatchEstimateFee(...args),
    },
  },
}));

function buildResponse(amount: string): IFetchBuildTxResponse {
  return {
    result: {
      ...quote,
      toAmount: amount,
      // Preserve the stale quote rate to exercise the final-amount calculation.
      instantRate: quote.instantRate,
    },
    supportRebuildTx: true,
    orderId: `review-repro-${amount}`,
    changellyOrder: {
      payinAddress: '0x0000000000000000000000000000000000000003',
      amountExpectedFrom: '0.1',
    },
  } as IFetchBuildTxResponse;
}

describe('useSwapBuildTx review rebuild', () => {
  it('keeps the rebuilt Review amount and price difference consistent after slippage save', async () => {
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockFetchBuildTx
      .mockResolvedValueOnce(buildResponse('98'))
      .mockResolvedValueOnce(buildResponse('90'));
    let resolveNonce!: (value: { nonce: number }) => void;
    mockFetchAccountDetails.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNonce = resolve;
        }),
    );
    mockPrepareUnsignedTx.mockImplementation(async (params) => ({
      ...params,
      encodedTx: {
        to: params.transfersInfo?.[0]?.to,
        value: '100000000000000000',
      },
    }));
    mockEstimateFee.mockResolvedValue({
      common: {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
        nativeTokenPrice: 1000,
      },
      gas: [{ gasPrice: '1', gasLimit: '21000' }],
    });

    const store = createStore();
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapStepsAtom(), {
      steps: [],
      quoteResult: quote,
      preSwapData: {
        fromToken,
        toToken,
        fromTokenAmount: '0.1',
        toTokenAmount: '120',
        slippage: 1,
        rateDifference: {
          value: '+20%',
          unit: ESwapRateDifferenceUnit.POSITIVE,
        },
      },
    });
    const Wrapper = ({ children }: { children?: ReactNode }) => (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
    const { result } = renderHook(() => useSwapBuildTx(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.preSwapBeforeStepActions(quote, fromToken, toToken);
    });
    const initialBuilt = store.get(swapStepsAtom()).preSwapData;
    expect(initialBuilt.stepBeforeActionsError).toBeUndefined();
    expect(mockPrepareUnsignedTx).toHaveBeenCalledWith(
      expect.objectContaining({ prefetchedOnChainNonce: undefined }),
    );
    resolveNonce({ nonce: 3 });
    expect(initialBuilt.toTokenAmount).toBe('98');
    expect(initialBuilt.rateDifference?.value).toBe('-2.00%');
    expect(
      initialBuilt.swapBuildResultData?.swapInfo?.swapBuildResData
        .supportRebuildTx,
    ).toBe(true);

    await act(async () => {
      await result.current.rebuildSwapWithSlippage({ slippagePercentage: 2 });
    });
    const rebuilt = store.get(swapStepsAtom()).preSwapData;
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
    expect(mockFetchBuildTx.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        slippagePercentage: 2,
        fromTokenAmount: '0.1',
      }),
    );
    expect(mockEstimateFee).toHaveBeenCalledTimes(2);
    expect(rebuilt.toTokenAmount).toBe('90');
    expect(rebuilt.swapBuildResultData?.swapInfo?.receiver.amount).toBe('90');
    expect(rebuilt.slippage).toBe(2);
    expect(rebuilt.swapBuildLoading).toBe(false);
    expect(rebuilt.estimateNetworkFeeLoading).toBe(false);
    expect(rebuilt.stepBeforeActionsError).toBeUndefined();
    expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
    expect(mockNavigateMessageConfirm).not.toHaveBeenCalled();
    // 0.1 ETH at $1000 is $100 input; receiving $90 is a 10% decrease.
    expect(rebuilt.rateDifference?.value).toBe('-10.00%');
  });

  it('prepares approval while build-tx is still pending', async () => {
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockFetchBuildTx.mockReset();
    mockPrepareSwapBuildTxContext.mockClear();
    mockPrepareUnsignedTx.mockReset();
    mockEstimateFee.mockReset();
    mockBatchEstimateFee.mockReset();
    mockGetVaultSettings.mockClear();
    mockGetVaultSettings.mockResolvedValue({
      supportBatchEstimateFee: { 'evm--1': true },
    });

    let resolveBuild!: (value: IFetchBuildTxResponse) => void;
    let resolveBuildStarted!: () => void;
    const buildStarted = new Promise<void>((resolve) => {
      resolveBuildStarted = resolve;
    });
    mockFetchBuildTx.mockImplementation(() => {
      resolveBuildStarted();
      return new Promise((resolve) => {
        resolveBuild = resolve;
      });
    });
    let resolveApprovalStarted!: () => void;
    const approvalStarted = new Promise<void>((resolve) => {
      resolveApprovalStarted = resolve;
    });
    let resolveApproval!: (value: unknown) => void;
    mockPrepareUnsignedTx.mockImplementation((params) => {
      if (params.approveInfo) {
        return new Promise((resolve) => {
          resolveApproval = resolve;
          resolveApprovalStarted();
        });
      }
      return Promise.resolve({
        ...params,
        encodedTx: { to: '0x4', value: '0' },
      });
    });
    mockEstimateFee.mockResolvedValue({
      common: {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
        nativeTokenPrice: 1000,
      },
      gas: [{ gasPrice: '1', gasLimit: '21000' }],
    });
    mockBatchEstimateFee.mockResolvedValue({
      common: {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
        nativeTokenPrice: 1000,
      },
      txFees: [
        { gas: [{ gasPrice: '1', gasLimit: '21000' }] },
        { gas: [{ gasPrice: '1', gasLimit: '21000' }] },
      ],
    });

    const approvalQuote = {
      ...quote,
      allowanceResult: { allowanceTarget: '0x4', amount: '0' },
    };
    const store = createStore();
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapStepsAtom(), {
      steps: [],
      quoteResult: approvalQuote,
      preSwapData: {
        fromToken,
        toToken,
        fromTokenAmount: approvalQuote.fromAmount,
        toTokenAmount: approvalQuote.toAmount,
        slippage: 1,
      },
    });
    const Wrapper = ({ children }: { children?: ReactNode }) => (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
    const { result } = renderHook(() => useSwapBuildTx(), { wrapper: Wrapper });

    await act(async () => {
      const pending = result.current.preSwapBeforeStepActions(
        approvalQuote,
        fromToken,
        toToken,
      );
      await Promise.all([approvalStarted, buildStarted]);
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
      expect(mockPrepareSwapBuildTxContext).toHaveBeenCalledTimes(1);
      expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);
      expect(mockEstimateFee).not.toHaveBeenCalled();
      expect(mockBatchEstimateFee).not.toHaveBeenCalled();
      resolveApproval({ encodedTx: { to: '0x4', value: '0' } });
      resolveBuild(buildResponse('98'));
      await pending;
    });
    expect(
      store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
    ).toBeUndefined();
    expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
  });

  it('starts the EVM nonce read while build-tx is pending', async () => {
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockFetchBuildTx.mockReset();
    mockPrepareUnsignedTx.mockReset();
    mockEstimateFee.mockReset();
    mockFetchAccountDetails.mockReset();
    mockFetchSwapTokenDetails.mockClear();
    mockGetVaultSettings.mockResolvedValue({});

    let resolveBuild!: (value: IFetchBuildTxResponse) => void;
    let resolveBuildStarted!: () => void;
    const buildStarted = new Promise<void>((resolve) => {
      resolveBuildStarted = resolve;
    });
    mockFetchBuildTx.mockImplementation(() => {
      resolveBuildStarted();
      return new Promise((resolve) => {
        resolveBuild = resolve;
      });
    });
    let resolveNonceStarted!: () => void;
    const nonceStarted = new Promise<void>((resolve) => {
      resolveNonceStarted = resolve;
    });
    mockFetchAccountDetails.mockImplementation(async () => {
      resolveNonceStarted();
      return { nonce: 3 };
    });
    mockPrepareUnsignedTx.mockImplementation(async (params) => ({
      ...params,
      encodedTx: { to: '0x4', value: '0' },
    }));
    let resolveEstimateStarted!: () => void;
    const estimateStarted = new Promise<void>((resolve) => {
      resolveEstimateStarted = resolve;
    });
    let resolveEstimate!: (value: unknown) => void;
    mockEstimateFee.mockImplementation(() => {
      resolveEstimateStarted();
      return new Promise((resolve) => {
        resolveEstimate = resolve;
      });
    });

    const store = createStore();
    store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
    store.set(swapStepsAtom(), {
      steps: [],
      quoteResult: quote,
      preSwapData: {
        fromToken,
        toToken,
        fromTokenAmount: quote.fromAmount,
        toTokenAmount: quote.toAmount,
        slippage: 1,
      },
    });
    const Wrapper = ({ children }: { children?: ReactNode }) => (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
    const { result } = renderHook(() => useSwapBuildTx(), { wrapper: Wrapper });

    let balanceReadsBeforeBuild = 0;
    await act(async () => {
      const pending = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
      await Promise.all([buildStarted, nonceStarted]);
      expect(mockPrepareUnsignedTx).not.toHaveBeenCalled();
      balanceReadsBeforeBuild = mockFetchSwapTokenDetails.mock.calls.length;
      resolveBuild(buildResponse('98'));
      await estimateStarted;
      expect(mockFetchSwapTokenDetails.mock.calls.length).toBeGreaterThan(
        balanceReadsBeforeBuild,
      );
      resolveEstimate({
        common: {
          feeDecimals: 9,
          feeSymbol: 'Gwei',
          nativeDecimals: 18,
          nativeSymbol: 'ETH',
          nativeTokenPrice: 1000,
        },
        gas: [{ gasPrice: '1', gasLimit: '21000' }],
      });
      await pending;
    });

    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(
      balanceReadsBeforeBuild + 1,
    );

    expect(mockPrepareUnsignedTx).toHaveBeenCalledWith(
      expect.objectContaining({
        prefetchedOnChainNonce: expect.objectContaining({
          nonce: 3,
          accountId: 'hd-repro--0',
          networkId: 'evm--1',
        }),
      }),
    );
    expect(
      store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
    ).toBeUndefined();
  });
});
