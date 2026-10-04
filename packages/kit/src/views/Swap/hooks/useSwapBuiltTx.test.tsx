/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
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
  ESwapRateDifferenceUnit,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapFromTokenAmountAtom,
  swapQuoteListAtom,
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
type INavigateTxConfirm = ReturnType<
  typeof import('../../../hooks/useSignatureConfirm').useSignatureConfirm
>['navigationToTxConfirm'];
const mockNavigateTxConfirm = jest.fn<
  ReturnType<INavigateTxConfirm>,
  Parameters<INavigateTxConfirm>
>();
const mockNavigateMessageConfirm = jest.fn();
const mockUpdateUnsignedTx = jest.fn(
  async ({ unsignedTx }: { unsignedTx: IUnsignedTxPro }) => unsignedTx,
);
const mockPrecheckUnsignedTxs = jest.fn<Promise<void>, unknown[]>(
  async () => undefined,
);
const mockSignAndSendTransaction = jest.fn<Promise<ISignedTxPro>, unknown[]>();
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
    serviceSend: {
      updateUnsignedTx: (params: Parameters<typeof mockUpdateUnsignedTx>[0]) =>
        mockUpdateUnsignedTx(params),
      precheckUnsignedTxs: (...args: unknown[]) =>
        mockPrecheckUnsignedTxs(...args),
      signAndSendTransaction: (...args: unknown[]) =>
        mockSignAndSendTransaction(...args),
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
}: {
  reviewQuote?: IFetchQuoteResult;
  steps?: ISwapStep[];
  preSwapData?: ISwapPreSwapData;
} = {}) {
  const store = createStore();
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
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
  const hook = renderHook(() => useSwapBuildTx({ onSwapBroadcast }), {
    wrapper: Wrapper,
  });
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
