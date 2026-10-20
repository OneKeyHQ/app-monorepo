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
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapRateDifferenceUnit,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapQuoteActionLockAtom,
  swapQuoteListAtom,
  swapStepsAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { createSwapReviewAnalytics } from '../utils/swapReviewAnalytics';

import { useSwapBuildTx } from './useSwapBuiltTx';

const mockFetchBuildTx = jest.fn<
  Promise<IFetchBuildTxResponse | undefined>,
  unknown[]
>();
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
  [IBuildUnsignedTxParams]
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
type INavigateTxConfirm = ReturnType<
  typeof import('../../../hooks/useSignatureConfirm').useSignatureConfirm
>['navigationToTxConfirm'];
const mockNavigateTxConfirm = jest.fn<
  ReturnType<INavigateTxConfirm>,
  Parameters<INavigateTxConfirm>
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
const mockUpdateUnsignedTx = jest.fn(
  async ({ unsignedTx }: { unsignedTx: IUnsignedTxPro }) => unsignedTx,
);
const mockPrecheckUnsignedTxs = jest.fn<Promise<void>, unknown[]>(
  async () => undefined,
);
const mockSignAndSendTransaction = jest.fn<
  Promise<ISignedTxPro>,
  [{ unsignedTx: IUnsignedTxPro }]
>();
const mockSignMessage = jest.fn<Promise<string>, unknown[]>();
const mockSaveSendHistory = jest.fn(async () => undefined);
const mockGenerateSwapHistory = jest.fn(async () => undefined);
type IApprovalNotificationState = {
  swapApprovingTransaction?: ISwapApproveTransaction;
};
let mockNotificationState: IApprovalNotificationState = {};
const mockSetNotification = jest.fn(
  (
    updater: (prev: IApprovalNotificationState) => IApprovalNotificationState,
  ) => {
    mockNotificationState = updater(mockNotificationState);
  },
);

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
  useInAppNotificationAtom: () => [mockNotificationState, mockSetNotification],
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
  useSwapTxHistoryActions: () => ({
    generateSwapHistoryItem: mockGenerateSwapHistory,
  }),
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
    serviceTransaction: { verifyTransaction: async () => undefined },
    serviceHistory: { saveSendConfirmHistoryTxs: () => mockSaveSendHistory() },
    serviceNotification: { blockNotificationForTxId: async () => undefined },
    serviceSend: {
      updateUnsignedTx: (params: Parameters<typeof mockUpdateUnsignedTx>[0]) =>
        mockUpdateUnsignedTx(params),
      precheckUnsignedTxs: (...args: unknown[]) =>
        mockPrecheckUnsignedTxs(...args),
      signAndSendTransaction: (
        params: Parameters<typeof mockSignAndSendTransaction>[0],
      ) => mockSignAndSendTransaction(params),
      signMessage: (...args: unknown[]) => mockSignMessage(...args),
      buildDecodedTx: async () => ({}),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderExecutionReview({
  reviewQuote = quote,
  preSwapData = {},
  steps = [{ type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY }],
  buildTxSource,
  quoteSource,
}: {
  reviewQuote?: IFetchQuoteResult;
  steps?: ISwapStep[];
  preSwapData?: ISwapPreSwapData;
  buildTxSource?: ESwapQuoteSource;
  quoteSource?: ESwapQuoteSource;
} = {}) {
  const store = createStore();
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
  store.set(swapQuoteActionLockAtom(), (previous) => ({
    ...previous,
    source: quoteSource,
  }));
  store.set(swapStepsAtom(), {
    steps,
    quoteResult: reviewQuote,
    preSwapData: { fromToken, toToken, ...preSwapData },
  });
  const onSwapBroadcast = jest.fn<void, [isReviewCurrent?: () => boolean]>();
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <ProviderJotaiContextSwap store={store}>
      {children}
    </ProviderJotaiContextSwap>
  );
  const hook = renderHook(
    () => useSwapBuildTx({ onSwapBroadcast, buildTxSource }),
    {
      wrapper: Wrapper,
    },
  );
  hook.result.current.beginSwapReview();
  return { ...hook, store, onSwapBroadcast };
}

describe('useSwapBuildTx confirmed execution ownership', () => {
  beforeEach(() => {
    mockNotificationState = {};
    mockSetNotification.mockClear();
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockFetchBuildTx.mockReset().mockResolvedValue(buildResponse('120'));
    mockFetchSwapTokenDetails
      .mockReset()
      .mockResolvedValue([{ balanceParsed: '100' }]);
    mockPrepareUnsignedTx.mockReset().mockImplementation(async (params) => ({
      ...params,
      encodedTx: { to: params.approveInfo ? '0x4' : '0x5', value: '0' },
    }));
    mockGetVaultSettings.mockReset().mockResolvedValue({});
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
    mockPrecheckUnsignedTxs.mockReset().mockResolvedValue(undefined);
    mockSignAndSendTransaction
      .mockReset()
      .mockResolvedValue({ txid: 'submitted-tx', rawTx: '', encodedTx: {} });
    mockSignMessage.mockReset().mockResolvedValue('signature');
    mockSaveSendHistory.mockClear();
    mockGenerateSwapHistory.mockClear();
    mockNavigateTxConfirm.mockReset();
  });

  it.each([
    {
      name: 'Desktop Market',
      buildTxSource: ESwapQuoteSource.MARKET,
      quoteSource: undefined,
      protocol: EProtocolOfExchange.SWAP,
      expectedSource: ESwapQuoteSource.MARKET,
    },
    {
      name: 'Desktop Market Stock',
      buildTxSource: ESwapQuoteSource.MARKET,
      quoteSource: undefined,
      protocol: EProtocolOfExchange.STOCK,
      expectedSource: ESwapQuoteSource.MARKET,
    },
    {
      name: 'ordinary Swap',
      buildTxSource: undefined,
      quoteSource: undefined,
      protocol: EProtocolOfExchange.SWAP,
      expectedSource: undefined,
    },
    {
      name: 'existing Market quote',
      buildTxSource: undefined,
      quoteSource: ESwapQuoteSource.MARKET,
      protocol: EProtocolOfExchange.SWAP,
      expectedSource: ESwapQuoteSource.MARKET,
    },
    {
      name: 'existing Sweep quote',
      buildTxSource: undefined,
      quoteSource: ESwapQuoteSource.SWEEP,
      protocol: EProtocolOfExchange.SWAP,
      expectedSource: ESwapQuoteSource.SWEEP,
    },
    {
      name: 'locked source before Market entry fallback',
      buildTxSource: ESwapQuoteSource.MARKET,
      quoteSource: ESwapQuoteSource.SWEEP,
      protocol: EProtocolOfExchange.SWAP,
      expectedSource: ESwapQuoteSource.SWEEP,
    },
  ])(
    'preserves build-only source attribution for $name through preview and rebuild',
    async ({ buildTxSource, quoteSource, protocol, expectedSource }) => {
      const reviewQuote = { ...quote, protocol };
      const { result, store } = renderExecutionReview({
        reviewQuote,
        buildTxSource,
        quoteSource,
      });

      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          reviewQuote,
          fromToken,
          toToken,
        );
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
      expect(mockFetchBuildTx.mock.calls[0][0]).toEqual(
        expect.objectContaining({ source: expectedSource, protocol }),
      );

      await act(async () => {
        await result.current.rebuildSwapWithSlippage({ slippagePercentage: 2 });
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
      expect(mockFetchBuildTx.mock.calls[1][0]).toEqual(
        expect.objectContaining({ source: expectedSource, protocol }),
      );
      expect(store.get(swapQuoteActionLockAtom()).source).toBe(quoteSource);
      expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(['unchanged', 'edited', 'reopened'])(
    'consumes only the submitted input after closing with %s input',
    async (mode) => {
      const sent = deferred<ISignedTxPro>();
      const started = deferred<void>();
      mockSignAndSendTransaction.mockImplementationOnce(() => {
        started.resolve();
        return sent.promise;
      });
      const { result, store, onSwapBroadcast } = renderExecutionReview();
      await act(async () => {
        store.set(swapFromTokenAmountAtom(), { value: '0.1', isInput: true });
        store.set(swapQuoteListAtom(), [quote]);
      });
      let execution!: Promise<void>;
      await act(async () => {
        execution = result.current.preSwapStepsStart();
        await started.promise;
      });
      await act(async () => {
        result.current.invalidateSwapReview();
        store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
        if (mode === 'edited') {
          store.set(swapFromTokenAmountAtom(), { value: '0.2', isInput: true });
        } else if (mode === 'reopened') {
          result.current.beginSwapReview();
          store.set(swapStepsAtom(), {
            steps: [
              { type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY },
            ],
            preSwapData: {},
            quoteResult: { ...quote },
          });
        }
      });
      const visibleReview = store.get(swapStepsAtom());
      await act(async () => {
        sent.resolve({ txid: 'swap-tx', rawTx: '', encodedTx: {} });
        await execution;
      });
      expect(mockGenerateSwapHistory).toHaveBeenCalledTimes(1);
      expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
      expect(onSwapBroadcast.mock.calls[0][0]?.()).toBe(false);
      expect(store.get(swapStepsAtom())).toBe(visibleReview);
      expect(store.get(swapFromTokenAmountAtom()).value).toBe(
        { unchanged: '', edited: '0.2', reopened: '0.1' }[mode],
      );
      expect(store.get(swapQuoteListAtom())).toHaveLength(
        mode === 'unchanged' ? 0 : 1,
      );
    },
  );

  it.each(['closed', 'replaced', 'cleared'])(
    'records a broadcast approval only in its own tracking slot: %s',
    async (mode) => {
      const sent = deferred<ISignedTxPro>();
      const started = deferred<void>();
      mockSignAndSendTransaction.mockImplementationOnce(() => {
        started.resolve();
        return sent.promise;
      });
      const { result, store } = renderExecutionReview({
        reviewQuote: {
          ...quote,
          allowanceResult: { allowanceTarget: '0x4', amount: '0' },
        },
        steps: [
          {
            type: ESwapStepType.APPROVE_TX,
            status: ESwapStepStatus.READY,
            shouldWaitApproved: true,
          },
        ],
      });
      let execution!: Promise<void>;
      await act(async () => {
        execution = result.current.preSwapStepsStart();
        await started.promise;
      });
      const original = mockNotificationState.swapApprovingTransaction;
      expect(original?.approvalRequestId).toBeDefined();
      await act(async () => {
        result.current.invalidateSwapReview();
        store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
        if (mode === 'replaced' && original) {
          mockNotificationState = {
            swapApprovingTransaction: {
              ...original,
              approvalRequestId: 'new-approval',
              txId: 'new-tx',
            },
          };
        } else if (mode === 'cleared') {
          mockNotificationState = {};
        }
      });
      await act(async () => {
        sent.resolve({ txid: 'approve-tx', rawTx: '', encodedTx: {} });
        await execution;
      });
      expect(mockSaveSendHistory).toHaveBeenCalledTimes(1);
      expect(mockNotificationState.swapApprovingTransaction?.txId).toBe(
        { closed: 'approve-tx', replaced: 'new-tx', cleared: undefined }[mode],
      );
      expect(store.get(swapStepsAtom()).steps).toEqual([]);
    },
  );

  it('fills fallback approval tracking after close without restoring its steps', async () => {
    const { result, store } = renderExecutionReview({
      reviewQuote: {
        ...quote,
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      },
      preSwapData: { shouldFallback: true },
      steps: [
        {
          type: ESwapStepType.APPROVE_TX,
          status: ESwapStepStatus.READY,
          shouldWaitApproved: true,
        },
      ],
    });
    await act(async () => {
      await result.current.preSwapStepsStart();
    });
    const confirmation = mockNavigateTxConfirm.mock.calls[0][0] as {
      onSuccess: (
        data: {
          signedTx: ISignedTxPro;
          approveInfo: { isMax: boolean; amount: string };
        }[],
      ) => void;
    };
    await act(async () => {
      result.current.invalidateSwapReview();
      store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
      confirmation.onSuccess([
        {
          signedTx: { txid: 'fallback-approve', rawTx: '', encodedTx: {} },
          approveInfo: { isMax: false, amount: '0.1' },
        },
      ]);
    });
    expect(mockNotificationState.swapApprovingTransaction?.txId).toBe(
      'fallback-approve',
    );
    expect(store.get(swapStepsAtom()).steps).toEqual([]);
  });

  it('keeps the confirmed slippage when another Review opens during approval', async () => {
    const sent = deferred<ISignedTxPro>();
    const started = deferred<void>();
    mockSignAndSendTransaction.mockImplementationOnce(() => {
      started.resolve();
      return sent.promise;
    });
    const { result, store } = renderExecutionReview({
      reviewQuote: {
        ...quote,
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      },
      preSwapData: { slippage: 0.5 },
      steps: [
        { type: ESwapStepType.APPROVE_TX, status: ESwapStepStatus.READY },
        { type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY },
      ],
    });
    let execution!: Promise<void>;
    await act(async () => {
      execution = result.current.preSwapStepsStart();
      await started.promise;
    });
    await act(async () => {
      result.current.invalidateSwapReview();
      result.current.beginSwapReview();
      store.set(swapStepsAtom(), {
        steps: [{ type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY }],
        quoteResult: { ...quote, quoteId: 'another-quote' },
        preSwapData: { slippage: 5 },
      });
    });
    const currentReview = store.get(swapStepsAtom());
    await act(async () => {
      sent.resolve({ txid: 'approve-tx', rawTx: '', encodedTx: {} });
      await execution;
    });
    expect(mockFetchBuildTx).toHaveBeenCalledWith(
      expect.objectContaining({ slippagePercentage: 0.5 }),
    );
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(2);
    expect(store.get(swapStepsAtom())).toBe(currentReview);
  });

  it.each(['update', 'precheck'])(
    'continues the confirmed transaction after closing during %s',
    async (stage) => {
      const pending = deferred<void>();
      const started = deferred<void>();
      if (stage === 'update') {
        mockUpdateUnsignedTx.mockImplementationOnce(async ({ unsignedTx }) => {
          started.resolve();
          await pending.promise;
          return unsignedTx;
        });
      } else {
        mockPrecheckUnsignedTxs.mockImplementationOnce(() => {
          started.resolve();
          return pending.promise;
        });
      }
      const { result, store } = renderExecutionReview();
      let execution!: Promise<void>;
      await act(async () => {
        execution = result.current.preSwapStepsStart();
        await started.promise;
      });
      await act(async () => {
        result.current.invalidateSwapReview();
        store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
      });
      await act(async () => {
        pending.resolve();
        await execution;
      });
      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
      expect(mockSaveSendHistory).toHaveBeenCalledTimes(1);
      expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
      expect(store.get(swapStepsAtom()).steps).toEqual([]);
    },
  );

  it.each(['batch', 'separate'])(
    'continues the confirmed %s approval and swap after close',
    async (mode) => {
      const sent = deferred<ISignedTxPro>();
      const started = deferred<void>();
      mockSignAndSendTransaction.mockImplementationOnce(() => {
        started.resolve();
        return sent.promise;
      });
      const { result, store } = renderExecutionReview({
        reviewQuote: {
          ...quote,
          allowanceResult: { allowanceTarget: '0x4', amount: '0' },
        },
        steps:
          mode === 'batch'
            ? [
                {
                  type: ESwapStepType.BATCH_APPROVE_SWAP,
                  status: ESwapStepStatus.READY,
                },
              ]
            : [
                {
                  type: ESwapStepType.APPROVE_TX,
                  status: ESwapStepStatus.READY,
                },
                { type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY },
              ],
      });
      let execution!: Promise<void>;
      await act(async () => {
        execution = result.current.preSwapStepsStart();
        await started.promise;
      });
      await act(async () => {
        result.current.invalidateSwapReview();
        store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
      });
      await act(async () => {
        sent.resolve({ txid: 'approve-tx', rawTx: '', encodedTx: {} });
        await execution;
      });
      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(2);
      expect(mockSaveSendHistory).toHaveBeenCalledTimes(2);
      expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
      expect(store.get(swapStepsAtom()).steps).toEqual([]);
    },
  );

  it('keeps a late swap broadcast in history without changing a reopened Review', async () => {
    const sent = deferred<ISignedTxPro>();
    const started = deferred<void>();
    mockSignAndSendTransaction.mockImplementationOnce(() => {
      started.resolve();
      return sent.promise;
    });
    const { result, store, onSwapBroadcast } = renderExecutionReview();
    let execution!: Promise<void>;
    await act(async () => {
      execution = result.current.preSwapStepsStart();
      await started.promise;
    });
    await act(async () => {
      result.current.invalidateSwapReview();
      result.current.beginSwapReview();
      store.set(swapStepsAtom(), {
        steps: [{ type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY }],
        preSwapData: {},
        quoteResult: { ...quote, quoteId: 'new-review' },
      });
    });
    const newReview = store.get(swapStepsAtom());
    await act(async () => {
      sent.resolve({ txid: 'swap-tx', rawTx: '', encodedTx: {} });
      await execution;
    });
    expect(mockSaveSendHistory).toHaveBeenCalledTimes(1);
    expect(mockGenerateSwapHistory).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast.mock.calls[0][0]?.()).toBe(false);
    expect(store.get(swapStepsAtom())).toBe(newReview);
  });

  it('continues fallback without restoring closed Review steps after an approval was sent', async () => {
    const pending = deferred<IUnsignedTxPro>();
    const started = deferred<void>();
    mockUpdateUnsignedTx
      .mockImplementationOnce(async ({ unsignedTx }) => unsignedTx)
      .mockImplementationOnce(() => {
        started.resolve();
        return pending.promise;
      });
    const { result, store } = renderExecutionReview({
      reviewQuote: {
        ...quote,
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      },
      steps: [
        {
          type: ESwapStepType.BATCH_APPROVE_SWAP,
          status: ESwapStepStatus.READY,
        },
      ],
    });
    let execution!: Promise<void>;
    await act(async () => {
      execution = result.current.preSwapStepsStart();
      await started.promise;
    });
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.invalidateSwapReview();
      store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
    });
    await act(async () => {
      pending.reject(new Error('second transaction preparation failed'));
      await execution;
    });
    expect(mockNavigateTxConfirm).toHaveBeenCalledTimes(1);
    expect(mockNavigateTxConfirm.mock.calls[0][0].approvesInfo).toBeUndefined();
    expect(mockSaveSendHistory).toHaveBeenCalledTimes(1);
    expect(store.get(swapStepsAtom()).steps).toEqual([]);
  });

  it('preserves a signed order submitted before close without updating a new Review', async () => {
    const built = deferred<IFetchBuildTxResponse>();
    const started = deferred<void>();
    mockFetchBuildTx.mockImplementationOnce(() => {
      started.resolve();
      return built.promise;
    });
    const signedQuote: IFetchQuoteResult = {
      ...quote,
      swapShouldSignedData: {
        unSignedInfo: {
          origin: 'test',
          scope: 'test',
          signedType: EMessageTypesEth.TYPED_DATA_V4,
        },
        unSignedMessage: 'typed-data',
      },
      quoteResultCtx: { cowSwapUnSignedOrder: {} },
    };
    const { result, store, onSwapBroadcast } = renderExecutionReview({
      reviewQuote: signedQuote,
      steps: [
        { type: ESwapStepType.SIGN_MESSAGE, status: ESwapStepStatus.READY },
      ],
    });
    let execution!: Promise<void>;
    await act(async () => {
      execution = result.current.preSwapStepsStart();
      await started.promise;
    });
    await act(async () => {
      result.current.invalidateSwapReview();
      result.current.beginSwapReview();
      store.set(swapStepsAtom(), {
        steps: [],
        preSwapData: {},
        quoteResult: { ...quote, quoteId: 'new-review' },
      });
    });
    const newReview = store.get(swapStepsAtom());
    await act(async () => {
      built.resolve({
        result: signedQuote,
        ctx: { cowSwapOrderId: 'submitted-order' },
      });
      await execution;
    });
    expect(mockGenerateSwapHistory).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast.mock.calls[0][0]?.()).toBe(false);
    expect(store.get(swapStepsAtom())).toBe(newReview);
  });

  it('does not start a delayed confirm after close', async () => {
    const { result, store } = renderExecutionReview();
    const oldReview = store.get(swapStepsAtom());
    await act(async () => {
      result.current.invalidateSwapReview();
      store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
    });
    await act(async () => {
      await result.current.preSwapStepsStart(oldReview);
    });
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('retains the confirmed fallback after the owning hook unmounts', async () => {
    const pending = deferred<unknown>();
    const started = deferred<void>();
    mockPrepareUnsignedTx.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const { result, unmount } = renderExecutionReview({
      reviewQuote: {
        ...quote,
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      },
      steps: [
        {
          type: ESwapStepType.BATCH_APPROVE_SWAP,
          status: ESwapStepStatus.READY,
        },
      ],
    });
    let execution!: Promise<void>;
    await act(async () => {
      execution = result.current.preSwapStepsStart();
      await started.promise;
    });
    unmount();
    await act(async () => {
      pending.reject(new Error('prepare failed'));
      await execution;
    });
    expect(mockNavigateTxConfirm).toHaveBeenCalledTimes(1);
  });

  it('still signs and records a transaction while its Review remains active', async () => {
    const { result, onSwapBroadcast } = renderExecutionReview();
    await act(async () => {
      await result.current.preSwapStepsStart();
    });
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(mockSaveSendHistory).toHaveBeenCalledTimes(1);
    expect(mockGenerateSwapHistory).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
  });

  it('still opens the fallback confirmation when the Review remains active', async () => {
    mockPrepareUnsignedTx.mockRejectedValueOnce(new Error('prepare failed'));
    const { result, store } = renderExecutionReview({
      reviewQuote: {
        ...quote,
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      },
      steps: [
        {
          type: ESwapStepType.BATCH_APPROVE_SWAP,
          status: ESwapStepStatus.READY,
        },
      ],
    });
    await act(async () => {
      await result.current.preSwapStepsStart();
    });
    expect(mockNavigateTxConfirm).toHaveBeenCalledTimes(1);
    expect(store.get(swapStepsAtom()).preSwapData.shouldFallback).toBe(true);
  });

  it('submits the confirmed signed order after closing during message signing', async () => {
    const signed = deferred<string>();
    const started = deferred<void>();
    mockSignMessage.mockImplementationOnce(() => {
      started.resolve();
      return signed.promise;
    });
    const { result, store } = renderExecutionReview({
      reviewQuote: {
        ...quote,
        swapShouldSignedData: {
          unSignedInfo: {
            origin: 'test',
            scope: 'test',
            signedType: EMessageTypesEth.TYPED_DATA_V4,
          },
          unSignedMessage: 'typed-data',
        },
        quoteResultCtx: { cowSwapUnSignedOrder: {} },
      },
      steps: [
        { type: ESwapStepType.SIGN_MESSAGE, status: ESwapStepStatus.READY },
      ],
    });
    let execution!: Promise<void>;
    await act(async () => {
      execution = result.current.preSwapStepsStart();
      await started.promise;
    });
    await act(async () => {
      result.current.invalidateSwapReview();
      store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
    });
    await act(async () => {
      signed.resolve('signature');
      await execution;
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockGenerateSwapHistory).toHaveBeenCalledTimes(1);
    expect(store.get(swapStepsAtom()).steps).toEqual([]);
  });

  it.each(['close', 'reopen'])(
    'does not restore fallback steps after %s during approval preparation',
    async (action) => {
      platformEnv.isNative = false;
      globalJotaiStorageReadyHandler.resolveReady(true);
      mockPrepareUnsignedTx.mockReset();
      mockNavigateTxConfirm.mockClear();
      const preparation = deferred<unknown>();
      const started = deferred<void>();
      mockPrepareUnsignedTx.mockImplementationOnce(() => {
        started.resolve();
        return preparation.promise;
      });
      const approvalQuote: IFetchQuoteResult = {
        ...quote,
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      };
      const store = createStore();
      store.set(swapStepsAtom(), {
        steps: [
          {
            type: ESwapStepType.BATCH_APPROVE_SWAP,
            status: ESwapStepStatus.READY,
          },
        ],
        quoteResult: approvalQuote,
        preSwapData: { fromToken, toToken },
      });
      const Wrapper = ({ children }: { children?: ReactNode }) => (
        <ProviderJotaiContextSwap store={store}>
          {children}
        </ProviderJotaiContextSwap>
      );
      const { result } = renderHook(() => useSwapBuildTx(), {
        wrapper: Wrapper,
      });
      let execution!: Promise<void>;
      await act(async () => {
        result.current.beginSwapReview();
        execution = result.current.preSwapStepsStart();
        await started.promise;
      });
      await act(async () => {
        result.current.invalidateSwapReview();
        store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
        if (action === 'reopen') {
          result.current.beginSwapReview();
          store.set(swapStepsAtom(), {
            steps: [
              { type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY },
            ],
            quoteResult: { ...quote, quoteId: 'new-review' },
            preSwapData: { fromToken, toToken },
          });
        }
      });
      const stateAfterClose = store.get(swapStepsAtom());
      await act(async () => {
        preparation.reject(new Error('approval preparation failed'));
        await execution;
      });
      expect(store.get(swapStepsAtom())).toBe(stateAfterClose);
      expect(mockNavigateTxConfirm).toHaveBeenCalledTimes(1);
      expect(
        mockNavigateTxConfirm.mock.calls[0][0].isNavigationCurrent?.(),
      ).toBe(true);
      expect(() =>
        mockNavigateTxConfirm.mock.calls[0][0].onBeforeSend?.(),
      ).not.toThrow();
    },
  );
});

describe('useSwapBuildTx review rebuild', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
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

  it.each(['approval failure', 'close and reopen the same quote'])(
    'does not let an old build overwrite a later Review after %s',
    async (scenario) => {
      platformEnv.isNative = false;
      globalJotaiStorageReadyHandler.resolveReady(true);
      mockFetchBuildTx.mockReset();
      mockPrepareUnsignedTx.mockReset();
      mockEstimateFee.mockReset();
      mockFetchAccountDetails.mockReset();
      mockFetchAccountDetails.mockResolvedValue({ nonce: 3 });
      mockGetVaultSettings.mockResolvedValue({});

      const quoteA: IFetchQuoteResult = {
        ...quote,
        quoteId: 'quote-A',
        allowanceResult: { allowanceTarget: '0x4', amount: '0' },
      };
      const reopensSameQuote = scenario === 'close and reopen the same quote';
      const quoteB: IFetchQuoteResult = reopensSameQuote
        ? quoteA
        : {
            ...quote,
            quoteId: 'quote-B',
            fromAmount: '0.2',
            toAmount: '240',
          };
      let resolveBuildA!: (value: IFetchBuildTxResponse) => void;
      let resolveBuildAStarted!: () => void;
      const buildAStarted = new Promise<void>((resolve) => {
        resolveBuildAStarted = resolve;
      });
      mockFetchBuildTx
        .mockImplementationOnce(() => {
          resolveBuildAStarted();
          return new Promise((resolve) => {
            resolveBuildA = resolve;
          });
        })
        .mockResolvedValue({
          ...buildResponse('230'),
          orderId: 'order-B',
          result: { ...quoteB, toAmount: '230' },
        });
      let rejectApprovalA!: (reason: Error) => void;
      let resolveApprovalAStarted!: () => void;
      const approvalAStarted = new Promise<void>((resolve) => {
        resolveApprovalAStarted = resolve;
      });
      mockPrepareUnsignedTx.mockImplementation((params) => {
        if (params.approveInfo && !rejectApprovalA) {
          resolveApprovalAStarted();
          return new Promise((_, reject) => {
            rejectApprovalA = reject;
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

      const store = createStore();
      store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
      store.set(swapStepsAtom(), {
        steps: [],
        quoteResult: quoteA,
        preSwapData: {
          fromToken,
          toToken,
          fromTokenAmount: quoteA.fromAmount,
          toTokenAmount: quoteA.toAmount,
          slippage: 1,
        },
      });
      const Wrapper = ({ children }: { children?: ReactNode }) => (
        <ProviderJotaiContextSwap store={store}>
          {children}
        </ProviderJotaiContextSwap>
      );
      const { result } = renderHook(() => useSwapBuildTx(), {
        wrapper: Wrapper,
      });

      await act(async () => {
        const pendingA = result.current.preSwapBeforeStepActions(
          quoteA,
          fromToken,
          toToken,
        );
        await Promise.all([approvalAStarted, buildAStarted]);
        if (reopensSameQuote) {
          result.current.invalidateSwapReview();
          store.set(swapStepsAtom(), { steps: [], preSwapData: {} });
        }
        rejectApprovalA(new Error('approval failed'));
        await pendingA;
      });
      if (reopensSameQuote) {
        expect(store.get(swapStepsAtom()).preSwapData).toEqual({});
      } else {
        expect(
          store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
        ).toBe(true);
        expect(store.get(swapStepsAtom()).preSwapData.swapBuildLoading).toBe(
          false,
        );
        expect(
          store.get(swapStepsAtom()).preSwapData.estimateNetworkFeeLoading,
        ).toBe(false);
      }

      await act(async () => {
        store.set(swapStepsAtom(), {
          steps: [],
          quoteResult: quoteB,
          preSwapData: {
            fromToken,
            toToken,
            fromTokenAmount: quoteB.fromAmount,
            toTokenAmount: quoteB.toAmount,
            slippage: 1,
          },
        });
      });
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          quoteB,
          fromToken,
          toToken,
        );
      });
      expect(
        store.get(swapStepsAtom()).preSwapData.swapBuildResultData?.orderId,
      ).toBe('order-B');

      await act(async () => {
        resolveBuildA({
          ...buildResponse('98'),
          orderId: 'order-A',
          result: { ...quoteA, toAmount: '98' },
        });
        await Promise.resolve();
      });
      const currentReview = store.get(swapStepsAtom());
      expect(currentReview.quoteResult).toBe(quoteB);
      expect(currentReview.preSwapData.toTokenAmount).toBe('230');
      expect(currentReview.preSwapData.swapBuildResultData?.orderId).toBe(
        'order-B',
      );
      expect(currentReview.preSwapData.stepBeforeActionsError).toBeUndefined();

      mockNavigateTxConfirm.mockClear();
      await act(async () => {
        result.current.beginSwapReview();
        await result.current.preSwapStepsStart({
          steps: [
            { type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY },
          ],
          preSwapData: { ...currentReview.preSwapData, shouldFallback: true },
          quoteResult: quoteB,
        });
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
      expect(mockNavigateTxConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          swapInfo: expect.objectContaining({
            swapBuildResData: expect.objectContaining({ orderId: 'order-B' }),
          }),
        }),
      );
    },
  );
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
  result.current.beginSwapReview();
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
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockNotificationState = {};
    mockFetchSwapTokenDetails
      .mockReset()
      .mockResolvedValue([{ balanceParsed: '100' }]);
    mockUpdateUnsignedTx
      .mockReset()
      .mockImplementation(async ({ unsignedTx }) => unsignedTx);
    mockPrecheckUnsignedTxs.mockReset().mockResolvedValue(undefined);
    mockSignMessage.mockReset().mockResolvedValue('signature');
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
    mockSignAndSendTransaction
      .mockReset()
      .mockImplementation(async (...args) => {
        const { unsignedTx } = args[0] as { unsignedTx: IUnsignedTxPro };
        return {
          txid: unsignedTx.approveInfo ? 'approval-tx' : 'swap-tx',
          rawTx: 'signed-test-tx',
          encodedTx: unsignedTx.encodedTx,
          swapInfo: unsignedTx.swapInfo,
        };
      });
    mockNavigateTxConfirm.mockReset().mockResolvedValue(undefined);
    mockGetVaultSettings.mockReset().mockResolvedValue({});
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
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
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
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
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
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
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
    mockSignAndSendTransaction.mockRejectedValueOnce(
      new Error('signature rejected'),
    );
    const review = renderReview();
    await review.send();

    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
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
      mockGetVaultSettings.mockResolvedValue({
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
      mockSignAndSendTransaction.mockImplementation(async ({ unsignedTx }) => {
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

      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(2);
      expect(
        mockSignAndSendTransaction.mock.calls[0][0].unsignedTx.approveInfo,
      ).toBeDefined();
      expect(
        mockSignAndSendTransaction.mock.calls[1][0].unsignedTx.swapInfo,
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
      mockSignAndSendTransaction.mockImplementation(async ({ unsignedTx }) => {
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

      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(2);
      expect(
        mockSignAndSendTransaction.mock.calls[0][0].unsignedTx.approveInfo,
      ).toBeDefined();
      expect(
        mockSignAndSendTransaction.mock.calls[1][0].unsignedTx.swapInfo,
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
    expect(
      mockSignAndSendTransaction.mock.calls[0][0].unsignedTx.swapInfo,
    ).toEqual(
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

    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
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
