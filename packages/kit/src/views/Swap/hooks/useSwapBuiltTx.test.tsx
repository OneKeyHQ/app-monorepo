/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import type { IBuildUnsignedTxParams } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  OneKeyLocalError,
  PasswordPromptDialogCancel,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapRateDifferenceUnit,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  ProviderJotaiContextSwap,
  swapStepNetFeeLevelAtom,
  swapStepsAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { createSwapReviewAnalytics } from '../utils/swapReviewAnalytics';

import { useSwapBuildTx } from './useSwapBuiltTx';

const mockFetchBuildTx = jest.fn<
  Promise<IFetchBuildTxResponse | undefined>,
  unknown[]
>();
const mockPrepareUnsignedTx = jest.fn<
  Promise<IUnsignedTxPro>,
  [IBuildUnsignedTxParams]
>();
const mockEstimateFee = jest.fn<Promise<unknown>, unknown[]>();
const mockUpdateUnsignedTx = jest.fn<
  Promise<IUnsignedTxPro>,
  [{ unsignedTx: IUnsignedTxPro; feeInfo: IFeeInfoUnit }]
>();
const mockBatchEstimateFee = jest.fn<Promise<unknown>, unknown[]>();
const mockGetCustomRpcForNetwork = jest.fn<
  Promise<{ rpc: string; enabled: boolean } | undefined>,
  [string]
>();
const mockVaultSettings = jest.fn<
  Promise<{ supportBatchEstimateFee?: Record<string, boolean> }>,
  []
>();
const mockSignAndSend = jest.fn<
  Promise<ISignedTxPro>,
  [{ unsignedTx: IUnsignedTxPro }]
>();
const mockNavigateTxConfirm = jest.fn<
  Promise<void>,
  [
    {
      swapInfo?: ISwapTxInfo;
      onSuccess?: (data: ISendTxOnSuccessData[]) => void;
      onCancel?: () => void;
    },
  ]
>();
const mockNavigateMessageConfirm = jest.fn();
const mockLogCreateOrder = jest.spyOn(
  defaultLogger.swap.createSwapOrder,
  'swapCreateOrder',
);
const mockLogEstimateFee = jest.spyOn(
  defaultLogger.swap.swapEstimateFee,
  'swapEstimateFee',
);
const mockLogSendTx = jest.spyOn(defaultLogger.swap.swapSendTx, 'swapSendTx');

let mockFromAccountId = 'hd-repro--0';

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
      account: { id: mockFromAccountId },
      indexedAccount: { id: 'hd-repro-index-0' },
      wallet: { type: 'hd' },
    },
  }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceCustomRpc: {
      getCustomRpcForNetwork: (networkId: string) =>
        mockGetCustomRpcForNetwork(networkId),
    },
    serviceToken: { getNativeTokenAddress: async () => '' },
    serviceSwap: {
      fetchSwapTokenDetails: async () => [{ balanceParsed: '100' }],
      fetchBuildTx: (...args: unknown[]) => mockFetchBuildTx(...args),
      swapRecentTokenPairsUpdate: async () => undefined,
    },
    serviceSend: {
      prepareSendConfirmUnsignedTx: (
        params: Parameters<typeof mockPrepareUnsignedTx>[0],
      ) => mockPrepareUnsignedTx(params),
      updateUnsignedTx: (params: Parameters<typeof mockUpdateUnsignedTx>[0]) =>
        mockUpdateUnsignedTx(params),
      precheckUnsignedTxs: async () => undefined,
      signAndSendTransaction: (params: Parameters<typeof mockSignAndSend>[0]) =>
        mockSignAndSend(params),
      buildDecodedTx: async () => ({
        totalFeeInNative: '0.000021',
        totalFeeFiatValue: '0.021',
      }),
    },
    serviceTransaction: { verifyTransaction: async () => undefined },
    serviceHistory: { saveSendConfirmHistoryTxs: async () => undefined },
    serviceNotification: { blockNotificationForTxId: async () => undefined },
    serviceNetwork: { getVaultSettings: () => mockVaultSettings() },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFromAccountId = 'hd-repro--0';
  mockGetCustomRpcForNetwork.mockReset().mockResolvedValue(undefined);
  platformEnv.isNative = false;
  globalJotaiStorageReadyHandler.resolveReady(true);
  mockFetchBuildTx.mockReset().mockResolvedValue(buildResponse('98'));
  mockPrepareUnsignedTx.mockReset().mockImplementation(async (params) => ({
    ...params,
    encodedTx: params.encodedTx ?? {
      from: '0x0000000000000000000000000000000000000002',
      to: params.approveInfo?.spender ?? params.transfersInfo?.[0]?.to ?? '',
      value: params.approveInfo ? '0' : '100000000000000000',
      data: params.approveInfo ? '0xapprove' : '0xswap',
    },
  }));
  mockEstimateFee.mockReset().mockResolvedValue({
    common: {
      feeDecimals: 9,
      feeSymbol: 'Gwei',
      nativeDecimals: 18,
      nativeSymbol: 'ETH',
      nativeTokenPrice: 1000,
    },
    gas: [{ gasPrice: '1', gasLimit: '21000' }],
  });
  mockUpdateUnsignedTx
    .mockReset()
    .mockImplementation(async ({ unsignedTx }) => unsignedTx);
  mockSignAndSend.mockReset().mockImplementation(async ({ unsignedTx }) => ({
    txid: unsignedTx.approveInfo ? 'approval-tx' : 'swap-tx',
    rawTx: 'signed-test-tx',
    encodedTx: unsignedTx.encodedTx,
    swapInfo: unsignedTx.swapInfo,
  }));
  mockNavigateTxConfirm.mockReset().mockResolvedValue(undefined);
  mockVaultSettings.mockReset().mockResolvedValue({});
  mockBatchEstimateFee.mockReset().mockResolvedValue({
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
});

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

function thorBuildResponse(selectedQuote = quote): IFetchBuildTxResponse {
  return {
    ...buildResponse('98'),
    changellyOrder: undefined,
    thorSwapCallData: {
      vault: '0x0000000000000000000000000000000000000003',
      amount: '100000000000000000',
      depositWithExpiry: '',
      asset: '',
      memo: '',
      memoStreamingSwap: '',
      expiration: '',
      fromAsset: '',
      amountIn: '100000000000000000',
    },
    result: { ...selectedQuote, gasLimit: 240_972 },
  };
}

describe('useSwapBuildTx review rebuild', () => {
  it('keeps the rebuilt Review amount and price difference consistent after slippage save', async () => {
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockFetchBuildTx
      .mockResolvedValueOnce(buildResponse('98'))
      .mockResolvedValueOnce(buildResponse('90'));
    mockPrepareUnsignedTx.mockImplementation(async (params) => ({
      ...params,
      encodedTx: {
        from: '0x0000000000000000000000000000000000000002',
        to: params.transfersInfo?.[0]?.to ?? '',
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
});

function renderReview({
  selectedQuote = quote,
  stepType = ESwapStepType.SEND_TX,
  preSwapData,
}: {
  selectedQuote?: IFetchQuoteResult;
  stepType?: ESwapStepType;
  preSwapData?: Partial<ISwapPreSwapData>;
} = {}) {
  const reviewAnalyticsRef = {
    current: createSwapReviewAnalytics({ reviewSessionId: 'review-session-1' }),
  };
  const store = createStore();
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
  store.set(swapStepsAtom(), {
    steps: [{ type: stepType, status: ESwapStepStatus.READY }],
    quoteResult: selectedQuote,
    preSwapData: {
      fromToken: selectedQuote.fromTokenInfo,
      toToken: selectedQuote.toTokenInfo,
      fromTokenAmount: selectedQuote.fromAmount,
      toTokenAmount: selectedQuote.toAmount,
      slippage: 1,
      ...preSwapData,
    },
  });
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <ProviderJotaiContextSwap store={store}>
      {children}
    </ProviderJotaiContextSwap>
  );
  const { result } = renderHook(() => useSwapBuildTx({ reviewAnalyticsRef }), {
    wrapper: Wrapper,
  });
  return {
    result,
    store,
    reviewAnalyticsRef,
    async prepare() {
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          selectedQuote,
          selectedQuote.fromTokenInfo,
          selectedQuote.toTokenInfo,
        );
      });
    },
    async send() {
      await act(async () => {
        await result.current.preSwapStepsStart();
      });
    },
  };
}

describe('useSwapBuildTx Review analytics', () => {
  it.each<{
    freshFees: boolean;
    sponsored: boolean;
    rpc: string;
    customPrice?: string;
    external?: boolean;
  }>([
    { freshFees: false, sponsored: false, rpc: 'off' },
    { freshFees: true, sponsored: false, rpc: 'off' },
    { freshFees: false, sponsored: true, rpc: 'off' },
    { freshFees: false, sponsored: true, rpc: 'on' },
    { freshFees: true, sponsored: true, rpc: 'on' },
    { freshFees: false, sponsored: true, rpc: 'enabled-before-send' },
    { freshFees: true, sponsored: true, rpc: 'enabled-before-send' },
    { freshFees: false, sponsored: true, rpc: 'disabled-before-send' },
    { freshFees: false, sponsored: true, rpc: 'off', customPrice: '12' },
    { freshFees: true, sponsored: true, rpc: 'off', customPrice: '12' },
    { freshFees: false, sponsored: true, rpc: 'off', external: true },
    { freshFees: true, sponsored: true, rpc: 'off', external: true },
    {
      freshFees: false,
      sponsored: true,
      rpc: 'off',
      external: true,
      customPrice: '12',
    },
    {
      freshFees: true,
      sponsored: true,
      rpc: 'off',
      external: true,
      customPrice: '12',
    },
    {
      freshFees: true,
      sponsored: true,
      rpc: 'on',
      external: true,
      customPrice: '12',
    },
  ])(
    'resolves Thor preview/send fees: fresh=$freshFees, sponsored=$sponsored, RPC=$rpc, custom=$customPrice, external=$external',
    async ({ freshFees, sponsored, rpc, customPrice, external }) => {
      if (external) mockFromAccountId = 'external--review';
      const initialCustomRpc = rpc === 'on' || rpc === 'disabled-before-send';
      const finalCustomRpc = rpc === 'on' || rpc === 'enabled-before-send';
      mockGetCustomRpcForNetwork.mockResolvedValue({
        rpc: 'https://rpc.example.com',
        enabled: initialCustomRpc,
      });
      if (sponsored) {
        mockEstimateFee.mockResolvedValue({
          common: {
            feeDecimals: 9,
            feeSymbol: 'Gwei',
            nativeDecimals: 18,
            nativeSymbol: 'ETH',
            nativeTokenPrice: 1000,
          },
          gas: [{ gasPrice: '0', originalGasPrice: '7', gasLimit: '50000' }],
          payer: 'megafuel',
          megafuelEligible: { sponsorable: true, sponsorName: 'MegaFuel' },
        });
      }
      mockFetchBuildTx.mockResolvedValue(thorBuildResponse());
      const review = renderReview();
      if (customPrice) {
        await act(async () => {
          review.store.set(swapStepNetFeeLevelAtom(), {
            networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
            customPriorityFee: { customValue: customPrice },
          });
        });
      }
      await review.prepare();
      const state = review.store.get(swapStepsAtom());
      const sponsoredGas = {
        gasPrice: '0',
        originalGasPrice: '7',
        gasLimit: '50000',
      };
      const userPaidGas = {
        gasPrice: customPrice ?? (sponsored ? '7' : '1'),
        ...(sponsored ? { originalGasPrice: '7' } : {}),
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      };
      const previewGasInfo =
        state.preSwapData.netWorkFee?.gasInfos?.[0].gasInfo;
      expect(previewGasInfo?.gas).toEqual(
        sponsored && !initialCustomRpc && !customPrice && !external
          ? sponsoredGas
          : userPaidGas,
      );
      if (initialCustomRpc || customPrice || external) {
        expect(previewGasInfo?.payer).toBe('user');
        expect(previewGasInfo?.megafuelEligible).toBeUndefined();
        expect(previewGasInfo?.gasAccountQuote).toBeUndefined();
      }
      expect(mockEstimateFee).toHaveBeenCalledWith(
        expect.objectContaining({ encodedTx: expect.any(Object) }),
      );
      if (freshFees) {
        await act(async () => {
          review.store.set(swapStepsAtom(), {
            ...state,
            preSwapData: { ...state.preSwapData, netWorkFee: undefined },
          });
        });
      }
      mockGetCustomRpcForNetwork.mockResolvedValue({
        rpc: 'https://rpc.example.com',
        enabled: finalCustomRpc,
      });
      await review.send();
      expect(mockEstimateFee).toHaveBeenCalledTimes(freshFees ? 2 : 1);
      expect(mockUpdateUnsignedTx).toHaveBeenLastCalledWith(
        expect.objectContaining({
          feeInfo: expect.objectContaining({
            gas:
              sponsored &&
              !initialCustomRpc &&
              !finalCustomRpc &&
              !customPrice &&
              !external
                ? sponsoredGas
                : userPaidGas,
          }),
        }),
      );
      expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { batch: false, freshFees: false },
    { batch: false, freshFees: true },
    { batch: true, freshFees: false },
    { batch: true, freshFees: true },
  ])(
    'keeps external Thor custom price after approval: batch=$batch, fresh=$freshFees',
    async ({ batch, freshFees }) => {
      mockFromAccountId = 'external--review';
      mockVaultSettings.mockResolvedValue({
        supportBatchEstimateFee: { 'evm--1': batch },
      });
      const approvalQuote: IFetchQuoteResult = {
        ...quote,
        fromTokenInfo: {
          ...fromToken,
          isNative: false,
          contractAddress: '0x0000000000000000000000000000000000000004',
          symbol: 'TEST',
        },
        allowanceResult: {
          allowanceTarget: '0x0000000000000000000000000000000000000005',
          amount: '0',
        },
      };
      mockFetchBuildTx.mockResolvedValue(thorBuildResponse(approvalQuote));
      const common = {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
        nativeTokenPrice: 1000,
      };
      const estimated = {
        gas: [{ gasPrice: '0', originalGasPrice: '7', gasLimit: '50000' }],
        megafuelEligible: { sponsorable: true, sponsorName: 'MegaFuel' },
      };
      mockEstimateFee.mockResolvedValue({ common, ...estimated });
      mockBatchEstimateFee.mockResolvedValue({
        common,
        txFees: [estimated, estimated],
      });
      const review = renderReview({
        selectedQuote: approvalQuote,
        stepType: ESwapStepType.BATCH_APPROVE_SWAP,
      });
      await act(async () => {
        review.store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
          customPriorityFee: { customValue: '12' },
        });
      });
      await review.prepare();
      const state = review.store.get(swapStepsAtom());
      expect(state.preSwapData.stepBeforeActionsError).toBeUndefined();
      const fees = state.preSwapData.netWorkFee?.gasInfos;
      expect(fees).toHaveLength(2);
      // The approval keeps its existing fee; only the Thor swap uses the override.
      expect(fees?.[0].gasInfo.gas).toEqual({
        gasPrice: '7',
        originalGasPrice: '7',
        gasLimit: '50000',
      });
      const swapGas = {
        gasPrice: '12',
        originalGasPrice: '7',
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      };
      expect(fees?.[1].gasInfo.gas).toEqual(swapGas);
      if (freshFees) {
        await act(async () => {
          review.store.set(swapStepsAtom(), {
            ...state,
            preSwapData: { ...state.preSwapData, netWorkFee: undefined },
          });
        });
      }
      await review.send();
      expect(mockSignAndSend).toHaveBeenCalledTimes(2);
      expect(mockUpdateUnsignedTx.mock.calls[0][0].feeInfo.gas).toEqual(
        fees?.[0].gasInfo.gas,
      );
      expect(mockUpdateUnsignedTx.mock.calls[1][0].feeInfo.gas).toEqual(
        swapGas,
      );
      expect(
        batch ? mockBatchEstimateFee : mockEstimateFee,
      ).toHaveBeenCalledTimes(freshFees ? 2 : 1);
    },
  );

  it('leaves external non-Thor fee selection unchanged', async () => {
    mockFromAccountId = 'external--review';
    mockEstimateFee.mockResolvedValue({
      common: {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
        nativeTokenPrice: 1000,
      },
      gas: [{ gasPrice: '0', originalGasPrice: '7', gasLimit: '50000' }],
    });
    const review = renderReview();
    await act(async () => {
      review.store.set(swapStepNetFeeLevelAtom(), {
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
        customPriorityFee: { customValue: '12' },
      });
    });
    await review.prepare();
    const expectedGas = {
      gasPrice: '7',
      originalGasPrice: '7',
      gasLimit: '50000',
    };
    expect(
      review.store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos?.[0]
        .gasInfo.gas,
    ).toEqual(expectedGas);
    await review.send();
    expect(mockUpdateUnsignedTx.mock.calls[0][0].feeInfo.gas).toEqual(
      expectedGas,
    );
  });

  it.each([undefined, [], [{ amount: '98' }]])(
    'retains the route fallback in create-order telemetry for build routes %j',
    async (routesData) => {
      const selectedQuote = { ...quote, routesData: [{ amount: '120' }] };
      const response = buildResponse('98');
      response.result.routesData = routesData;
      mockFetchBuildTx.mockResolvedValueOnce(response);
      const review = renderReview({ selectedQuote });
      await review.prepare();
      expect(mockLogCreateOrder).toHaveBeenCalledTimes(1);
      expect(mockLogCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ESwapEventAPIStatus.SUCCESS,
          router: JSON.stringify(
            routesData?.length ? routesData : selectedQuote.routesData,
          ),
        }),
      );
      expect(mockPrepareUnsignedTx).toHaveBeenCalledTimes(1);
      expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves empty routes when neither response nor quote supplies a route', async () => {
    const response = buildResponse('98');
    response.result.routesData = [];
    mockFetchBuildTx.mockResolvedValueOnce(response);
    await renderReview().prepare();
    expect(mockLogCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ router: '[]' }),
    );
  });

  it('reports an empty build response without changing the subsequent preparation path', async () => {
    mockFetchBuildTx.mockResolvedValueOnce(undefined);
    const prepareError = new Error('Missing transaction input');
    mockPrepareUnsignedTx.mockImplementationOnce(async (params) => {
      expect(params.encodedTx).toBeUndefined();
      expect(params.transfersInfo).toBeUndefined();
      throw prepareError;
    });
    const review = renderReview();
    const analytics = review.reviewAnalyticsRef.current;
    analytics.open({
      quoteId: quote.quoteId,
      swapProvider: quote.info.provider,
      swapType: 'Bridge',
      sourceChain: fromToken.networkId,
      receivedChain: toToken.networkId,
      sourceTokenSymbol: fromToken.symbol,
      receivedTokenSymbol: toToken.symbol,
      createFrom: 'swapPage',
      walletType: 'hd',
      supportPreBuild: true,
      needApprove: false,
    });
    const preparation = analytics.beginPreparation();
    await act(async () => {
      await review.result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
        preparation,
      );
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockPrepareUnsignedTx).toHaveBeenCalledTimes(1);
    expect(mockFetchBuildTx.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrepareUnsignedTx.mock.invocationCallOrder[0],
    );
    expect(mockEstimateFee).not.toHaveBeenCalled();
    expect(mockSignAndSend).not.toHaveBeenCalled();
    expect(
      review.store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
    ).toBe(true);
    expect(preparation?.failedStage).toBe('buildTx');
    expect(mockLogCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockLogCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ESwapEventAPIStatus.FAIL,
        message: 'Empty build response',
        reviewSessionId: 'review-session-1',
        quoteId: quote.quoteId,
        isPreBuild: true,
      }),
    );
  });

  it('prepares and sends successfully when create-order logging throws', async () => {
    mockLogCreateOrder.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Telemetry unavailable');
    });
    const review = renderReview();

    await review.prepare();
    await review.send();

    expect(mockLogCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockPrepareUnsignedTx).toHaveBeenCalled();
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    expect(review.store.get(swapStepsAtom()).steps[0]).toEqual(
      expect.objectContaining({
        status: ESwapStepStatus.PENDING,
        txHash: 'swap-tx',
      }),
    );
    expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
  });

  it('reports one send success when confirming a cached build and gas estimate', async () => {
    const review = renderReview();
    await review.prepare();

    expect(mockLogCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewSessionId: 'review-session-1',
        quoteId: quote.quoteId,
        orderId: 'review-repro-98',
        isPreBuild: true,
      }),
    );
    expect(mockLogEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewSessionId: 'review-session-1',
        quoteId: quote.quoteId,
        orderId: 'review-repro-98',
        status: ESwapEventAPIStatus.SUCCESS,
      }),
    );
    await review.send();

    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    expect(mockLogCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockLogEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockLogSendTx).toHaveBeenCalledTimes(1);
    expect(mockLogSendTx).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewSessionId: 'review-session-1',
        quoteId: quote.quoteId,
        orderId: 'review-repro-98',
        status: ESwapEventAPIStatus.SUCCESS,
      }),
    );
    expect(review.store.get(swapStepsAtom()).steps[0]).toEqual(
      expect.objectContaining({
        status: ESwapStepStatus.PENDING,
        txHash: 'swap-tx',
      }),
    );
  });

  it('records zero build time for a cached build while estimating fees again', async () => {
    const review = renderReview();
    await review.prepare();
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);

    review.reviewAnalyticsRef.current.open({
      quoteId: quote.quoteId,
      swapProvider: quote.info.provider,
      swapType: 'swap',
      sourceChain: fromToken.networkId,
      receivedChain: toToken.networkId,
      sourceTokenSymbol: fromToken.symbol,
      receivedTokenSymbol: toToken.symbol,
      createFrom: 'swapPage',
      walletType: 'hd',
      supportPreBuild: true,
      needApprove: false,
    });
    const preparation = review.reviewAnalyticsRef.current.beginPreparation();
    expect(preparation).toBeDefined();

    await act(async () => {
      await review.result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
        preparation,
      );
    });

    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockLogCreateOrder).toHaveBeenCalledTimes(1);
    expect(preparation?.timings.buildTxMs).toBe(0);
    expect(mockEstimateFee).toHaveBeenCalledTimes(2);
    expect(mockLogEstimateFee).toHaveBeenCalledTimes(2);
    expect(preparation?.timings.estimateFeeMs).toBeDefined();
    expect(
      review.store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
    ).toBeUndefined();
  });

  it('keeps a successful estimate successful when the subsequent signature is rejected', async () => {
    mockSignAndSend.mockRejectedValueOnce(new Error('signature rejected'));
    const review = renderReview();
    await review.send();

    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSignAndSend).toHaveBeenCalledTimes(1);
    expect(mockLogEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockLogEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({ status: ESwapEventAPIStatus.SUCCESS }),
    );
    expect(mockLogSendTx).toHaveBeenCalledTimes(1);
    expect(mockLogSendTx).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewSessionId: 'review-session-1',
        quoteId: quote.quoteId,
        orderId: 'review-repro-98',
        status: ESwapEventAPIStatus.FAIL,
        message: 'Transaction rejected',
      }),
    );
    expect(mockLogCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ isPreBuild: false }),
    );
    expect(review.store.get(swapStepsAtom()).steps[0].status).toBe(
      ESwapStepStatus.FAILED,
    );
    expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'reports only the swap send failure after approval with batch estimation %s',
    async (supportBatchEstimateFee) => {
      mockVaultSettings.mockResolvedValue({
        supportBatchEstimateFee: { 'evm--1': supportBatchEstimateFee },
      });
      const approvalQuote: IFetchQuoteResult = {
        ...quote,
        fromTokenInfo: {
          ...fromToken,
          isNative: false,
          contractAddress: '0x0000000000000000000000000000000000000004',
          symbol: 'TEST',
        },
        allowanceResult: {
          allowanceTarget: '0x0000000000000000000000000000000000000005',
          amount: '0',
        },
      };
      mockFetchBuildTx.mockResolvedValue({
        ...buildResponse('98'),
        result: { ...approvalQuote, toAmount: '98' },
      });
      mockSignAndSend.mockImplementation(async ({ unsignedTx }) => {
        if (!unsignedTx.approveInfo)
          throw new OneKeyLocalError('swap RPC failed');
        return {
          txid: 'approval-tx',
          rawTx: 'signed-approval',
          encodedTx: unsignedTx.encodedTx,
        };
      });
      const review = renderReview({
        selectedQuote: approvalQuote,
        stepType: ESwapStepType.BATCH_APPROVE_SWAP,
      });
      await review.send();

      expect(mockSignAndSend).toHaveBeenCalledTimes(2);
      expect(
        mockSignAndSend.mock.calls[0][0].unsignedTx.approveInfo,
      ).toBeDefined();
      expect(
        mockSignAndSend.mock.calls[1][0].unsignedTx.swapInfo,
      ).toBeDefined();
      expect(mockLogSendTx).toHaveBeenCalledTimes(1);
      expect(mockLogSendTx).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ESwapEventAPIStatus.FAIL,
          message: 'Network error',
          reviewSessionId: 'review-session-1',
          quoteId: quote.quoteId,
        }),
      );
      expect(mockLogEstimateFee.mock.calls).toEqual(
        supportBatchEstimateFee
          ? [
              [
                expect.objectContaining({
                  status: ESwapEventAPIStatus.SUCCESS,
                  isBatch: true,
                  reviewSessionId: 'review-session-1',
                  quoteId: quote.quoteId,
                }),
              ],
            ]
          : [],
      );
      expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      scenario: 'password prompt cancellation',
      error: new PasswordPromptDialogCancel(),
    },
    { scenario: 'serialized device cancellation', error: { code: 803 } },
    {
      scenario: 'wallet rejection',
      error: new Error('User rejected the request'),
    },
  ])(
    'does not report the new sequential swap failure event for $scenario',
    async ({ error }) => {
      const approvalQuote: IFetchQuoteResult = {
        ...quote,
        fromTokenInfo: {
          ...fromToken,
          isNative: false,
          contractAddress: '0x0000000000000000000000000000000000000004',
          symbol: 'TEST',
        },
        allowanceResult: {
          allowanceTarget: '0x0000000000000000000000000000000000000005',
          amount: '0',
        },
      };
      mockFetchBuildTx.mockResolvedValue({
        ...buildResponse('98'),
        result: { ...approvalQuote, toAmount: '98' },
      });
      mockSignAndSend.mockImplementation(async ({ unsignedTx }) => {
        if (!unsignedTx.approveInfo) throw error;
        return {
          txid: 'approval-tx',
          rawTx: 'signed-approval',
          encodedTx: unsignedTx.encodedTx,
        };
      });
      const review = renderReview({
        selectedQuote: approvalQuote,
        stepType: ESwapStepType.BATCH_APPROVE_SWAP,
      });
      await review.send();

      expect(mockSignAndSend).toHaveBeenCalledTimes(2);
      expect(
        mockSignAndSend.mock.calls[0][0].unsignedTx.approveInfo,
      ).toBeDefined();
      expect(
        mockSignAndSend.mock.calls[1][0].unsignedTx.swapInfo,
      ).toBeDefined();
      expect(mockEstimateFee).toHaveBeenCalledTimes(1);
      expect(mockLogEstimateFee).not.toHaveBeenCalled();
      expect(mockLogSendTx).not.toHaveBeenCalled();
      expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
      expect(review.store.get(swapStepsAtom()).steps[0].status).toBe(
        ESwapStepStatus.FAILED,
      );
    },
  );

  it('keeps the original session when the current Review changes during build and send', async () => {
    const review = renderReview();
    mockFetchBuildTx.mockImplementationOnce(async () => {
      review.reviewAnalyticsRef.current = createSwapReviewAnalytics({
        reviewSessionId: 'replacement-review-session',
      });
      return buildResponse('98');
    });
    await review.send();

    for (const logger of [
      mockLogCreateOrder,
      mockLogEstimateFee,
      mockLogSendTx,
    ]) {
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewSessionId: 'review-session-1',
          quoteId: quote.quoteId,
          orderId: 'review-repro-98',
          status: ESwapEventAPIStatus.SUCCESS,
        }),
      );
    }
    expect(mockSignAndSend.mock.calls[0][0].unsignedTx.swapInfo).toEqual(
      expect.objectContaining({
        reviewAnalyticsContext: expect.objectContaining({
          reviewSessionId: 'review-session-1',
          quoteId: quote.quoteId,
        }),
      }),
    );
  });

  it('logs the actual swap from a late fallback callback with an approval first', async () => {
    const review = renderReview({ preSwapData: { shouldFallback: true } });
    await review.send();
    expect(mockNavigateTxConfirm).toHaveBeenCalledTimes(1);
    expect(mockLogSendTx).not.toHaveBeenCalled();
    const fallback = mockNavigateTxConfirm.mock.calls[0][0];
    review.reviewAnalyticsRef.current = createSwapReviewAnalytics({
      reviewSessionId: 'replacement-review-session',
    });
    const decodedTx = {
      totalFeeInNative: '0.000021',
      totalFeeFiatValue: '0.021',
    } as ISendTxOnSuccessData['decodedTx'];
    await act(async () => {
      fallback.onSuccess?.([
        {
          signedTx: {
            txid: 'approval-tx',
            rawTx: 'approval-raw-tx',
            encodedTx: {},
          },
          decodedTx,
        },
        {
          signedTx: {
            txid: 'fallback-swap-tx',
            rawTx: 'swap-raw-tx',
            encodedTx: {},
            swapInfo: fallback.swapInfo,
          },
          decodedTx,
        },
      ]);
    });

    expect(mockSignAndSend).not.toHaveBeenCalled();
    expect(mockLogSendTx).toHaveBeenCalledTimes(1);
    expect(mockLogSendTx).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewSessionId: 'review-session-1',
        quoteId: quote.quoteId,
        orderId: 'review-repro-98',
        status: ESwapEventAPIStatus.SUCCESS,
      }),
    );
  });
});
