/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import { Toast } from '@onekeyhq/components';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { runSwapPreviewTask } from '@onekeyhq/shared/src/utils/swapPreviewTask';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapRateDifferenceUnit,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ProviderJotaiContextSwap,
  swapStepNetFeeLevelAtom,
  swapStepsAtom,
  swapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import {
  createSwapReviewPreloadWithBuildCache,
  getSwapReviewPreparationKey,
} from '../utils/swapReviewPreload';

import { useSwapBuildTx } from './useSwapBuiltTx';

import type { ISwapPreparedBuild, ISwapPreparedReview } from './useSwapBuiltTx';

const mockFetchBuildTx = jest.fn<Promise<IFetchBuildTxResponse>, unknown[]>();
const mockPrepareUnsignedTx = jest.fn<
  Promise<unknown>,
  [
    {
      transfersInfo?: Array<{ to: string }>;
      approveInfo?: { amount: string };
      prevNonce?: number;
    },
  ]
>();
const mockEstimateFee = jest.fn<Promise<unknown>, unknown[]>();
const mockFetchBalance = jest
  .fn<Promise<{ balanceParsed: string }[]>, unknown[]>()
  .mockResolvedValue([{ balanceParsed: '100' }]);
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
      fetchSwapTokenDetails: (...args: unknown[]) => mockFetchBalance(...args),
      fetchBuildTx: (...args: unknown[]) => mockFetchBuildTx(...args),
      prepareReviewUnsignedTx: (
        params: Parameters<typeof mockPrepareUnsignedTx>[0],
      ) => runSwapPreviewTask(() => mockPrepareUnsignedTx(params)),
      preloadBuildTx: (...args: unknown[]) =>
        runSwapPreviewTask(() => mockFetchBuildTx(...args)),
      swapRecentTokenPairsUpdate: async () => undefined,
    },
    serviceSend: {
      prepareSendConfirmUnsignedTx: (
        params: Parameters<typeof mockPrepareUnsignedTx>[0],
      ) => mockPrepareUnsignedTx(params),
    },
    serviceNetwork: { getVaultSettings: async () => ({}) },
    serviceGas: {
      buildEstimateFeeParams: async ({
        encodedTx,
      }: {
        encodedTx: unknown;
      }) => ({ encodedTx }),
      estimateFee: (...args: unknown[]) => mockEstimateFee(...args),
      estimateSwapPreviewFee: (...args: unknown[]) =>
        runSwapPreviewTask(() => mockEstimateFee(...args)),
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

function pendingValue<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPreview(reviewQuote = quote) {
  const store = createStore();
  store.set(swapTypeSwitchAtom(), ESwapTabSwitchType.SWAP);
  store.set(swapStepsAtom(), {
    steps: [],
    quoteResult: reviewQuote,
    preSwapData: { fromToken: reviewQuote.fromTokenInfo, toToken, slippage: 1 },
  });
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <ProviderJotaiContextSwap store={store}>
      {children}
    </ProviderJotaiContextSwap>
  );
  return { store, ...renderHook(() => useSwapBuildTx(), { wrapper: Wrapper }) };
}

const previewFee = {
  common: {
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
    nativeTokenPrice: 1000,
  },
  gas: [{ gasPrice: '1', gasLimit: '21000' }],
};

describe('Swap preview preparation concurrency', () => {
  beforeEach(() => {
    platformEnv.isNative = false;
    globalJotaiStorageReadyHandler.resolveReady(true);
    mockFetchBuildTx.mockReset().mockResolvedValue(buildResponse('98'));
    mockPrepareUnsignedTx.mockReset().mockImplementation(async (params) => ({
      ...params,
      nonce: params.prevNonce === undefined ? 7 : params.prevNonce + 1,
      encodedTx: {
        to: params.transfersInfo?.[0]?.to,
        value: '100000000000000000',
      },
    }));
    mockEstimateFee.mockReset().mockResolvedValue(previewFee);
    mockFetchBalance.mockReset().mockResolvedValue([{ balanceParsed: '100' }]);
    mockNavigateTxConfirm.mockClear();
    mockNavigateMessageConfirm.mockClear();
    jest.mocked(Toast.error).mockClear();
  });

  it('keeps insufficient balances ahead of order creation', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0' }]);
    const { result, store } = renderPreview();
    await act(async () => {
      await result.current.preSwapBeforeStepActions(quote, fromToken, toToken);
    });
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    expect(mockEstimateFee).not.toHaveBeenCalled();
    expect(store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError).toBe(
      true,
    );
  });

  it('checks the native input again with its estimated fee', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0.1' }]);
    const { result, store } = renderPreview();
    await act(async () => {
      await result.current.preSwapBeforeStepActions(quote, fromToken, toToken);
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockFetchBalance).toHaveBeenCalledTimes(2);
    expect(store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError).toBe(
      true,
    );
    expect(
      store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos,
    ).toHaveLength(1);
  });

  it('does not let an older fee response replace the latest fee selection', async () => {
    const oldFee = pendingValue<typeof previewFee>();
    const started = pendingValue<void>();
    mockEstimateFee.mockImplementationOnce(() => {
      started.resolve();
      return oldFee.promise;
    });
    const { result, store } = renderPreview();
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
      await started.promise;
    });
    await act(async () => {
      store.set(swapStepNetFeeLevelAtom(), {
        networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      });
    });
    await act(async () => {
      await result.current.preSwapBeforeStepActions(quote, fromToken, toToken);
    });
    const latest = store.get(swapStepsAtom()).preSwapData;
    expect(latest.netWorkFee?.gasInfos?.[0].gasInfo.gas?.gasPrice).toBe('1');
    await act(async () => {
      oldFee.resolve({
        ...previewFee,
        gas: [{ gasPrice: '99', gasLimit: '21000' }],
      });
      await first;
    });
    expect(store.get(swapStepsAtom()).preSwapData).toEqual(latest);
  });

  it('ignores a build response after the review is closed', async () => {
    const response = pendingValue<IFetchBuildTxResponse>();
    const started = pendingValue<void>();
    mockFetchBuildTx.mockImplementationOnce(() => {
      started.resolve();
      return response.promise;
    });
    const { result, store, unmount } = renderPreview();
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
      await started.promise;
    });
    unmount();
    const before = store.get(swapStepsAtom());
    await act(async () => {
      response.resolve(buildResponse('80'));
      await first;
    });
    expect(store.get(swapStepsAtom())).toEqual(before);
    expect(mockEstimateFee).not.toHaveBeenCalled();
  });

  it('reports a balance failure without waiting for a pending approval request', async () => {
    const approval = pendingValue<unknown>();
    const approvalQuote: IFetchQuoteResult = {
      ...quote,
      allowanceResult: { allowanceTarget: '0xspender', amount: '0' },
    };
    mockPrepareUnsignedTx.mockReturnValueOnce(approval.promise);
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0' }]);
    const { result, store } = renderPreview(approvalQuote);
    await act(async () => {
      await result.current.preSwapBeforeStepActions(
        approvalQuote,
        fromToken,
        toToken,
      );
    });
    expect(store.get(swapStepsAtom()).preSwapData).toMatchObject({
      stepBeforeActionsLoading: false,
      stepBeforeActionsError: true,
      swapBuildLoading: false,
      estimateNetworkFeeLoading: false,
    });
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    approval.resolve({ encodedTx: {}, nonce: 7 });
  });

  it('clears the superseded preparation lock when a slippage rebuild fails', async () => {
    const oldFee = pendingValue<typeof previewFee>();
    const started = pendingValue<void>();
    mockEstimateFee.mockImplementationOnce(() => {
      started.resolve();
      return oldFee.promise;
    });
    const { result, store } = renderPreview();
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
      await started.promise;
    });
    mockFetchBuildTx.mockRejectedValueOnce(new Error('build unavailable'));
    await act(async () => {
      await expect(
        result.current.rebuildSwapWithSlippage({ slippagePercentage: 2 }),
      ).rejects.toThrow('build unavailable');
    });
    expect(store.get(swapStepsAtom()).preSwapData).toMatchObject({
      stepBeforeActionsLoading: false,
      stepBeforeActionsError: true,
      swapBuildLoading: false,
      estimateNetworkFeeLoading: false,
    });
    await act(async () => {
      oldFee.resolve(previewFee);
      await first;
    });
    expect(store.get(swapStepsAtom()).preSwapData.netWorkFee).toBeUndefined();
    expect(store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError).toBe(
      true,
    );
  });

  it('preserves reset, approval and swap nonce order after build', async () => {
    const response = pendingValue<IFetchBuildTxResponse>();
    const buildStarted = pendingValue<void>();
    const approvalQuote: IFetchQuoteResult = {
      ...quote,
      fromTokenInfo: {
        ...fromToken,
        isNative: false,
        contractAddress: '0xtoken',
      },
      allowanceResult: {
        allowanceTarget: '0xspender',
        amount: '0',
        shouldResetApprove: true,
      },
    };
    mockFetchBuildTx.mockImplementationOnce(() => {
      buildStarted.resolve();
      return response.promise;
    });
    mockPrepareUnsignedTx.mockImplementation(async (params) => {
      return {
        ...params,
        nonce: params.prevNonce === undefined ? 7 : params.prevNonce + 1,
        encodedTx: { to: '0xrecipient', value: '0' },
      };
    });
    const { result, store } = renderPreview(approvalQuote);
    let first!: Promise<void>;
    await act(async () => {
      first = result.current.preSwapBeforeStepActions(
        approvalQuote,
        approvalQuote.fromTokenInfo,
        toToken,
      );
      await buildStarted.promise;
    });
    expect(mockPrepareUnsignedTx).not.toHaveBeenCalled();
    await act(async () => {
      response.resolve(buildResponse('98'));
      await first;
    });
    expect(
      mockPrepareUnsignedTx.mock.calls
        .slice(0, 2)
        .map(([params]) => [params.approveInfo?.amount, params.prevNonce]),
    ).toEqual([
      ['0', undefined],
      ['0.1', 7],
    ]);
    expect(mockPrepareUnsignedTx.mock.calls[2][0].prevNonce).toBe(8);
    expect(
      store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
    ).toBeUndefined();
    expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
  });
  it('estimates before Preview, then joins the same pending Promise across the quote clone', async () => {
    const fee = pendingValue<unknown>();
    const build = pendingValue<IFetchBuildTxResponse>();
    mockEstimateFee.mockReturnValueOnce(fee.promise);
    mockFetchBuildTx.mockReturnValueOnce(build.promise);
    const { result, store } = renderPreview();
    const before = store.get(swapStepsAtom());
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const key = getSwapReviewPreparationKey(
      quote,
      result.current.reviewPreparationContextKey,
    );
    const task = cache.preload(
      key,
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    await waitFor(() => expect(mockFetchBuildTx).toHaveBeenCalledTimes(1));
    expect(mockEstimateFee).not.toHaveBeenCalled();
    await act(async () => {
      build.resolve(buildResponse('98'));
    });
    await waitFor(() => expect(mockEstimateFee).toHaveBeenCalledTimes(1));
    expect(store.get(swapStepsAtom())).toBe(before);
    const copiedQuote = { ...quote };
    await act(async () => {
      store.set(swapStepsAtom(), { ...before, quoteResult: copiedQuote });
      result.current.beginGasAccountReviewSession();
    });
    const claimed = cache.claim(
      key,
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    expect(claimed.promise).toBe(task.promise);
    let preview: Promise<void> | undefined;
    await act(async () => {
      preview = result.current.preSwapBeforeStepActions(
        copiedQuote,
        fromToken,
        toToken,
        claimed,
      );
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    await act(async () => {
      fee.resolve(previewFee);
      await preview;
    });
    expect(
      store.get(swapStepsAtom()).preSwapData.stepBeforeActionsLoading,
    ).toBe(false);
    expect(store.get(swapStepsAtom()).preSwapData.toTokenAmount).toBe('98');
    expect(
      store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos,
    ).toHaveLength(1);
  });

  it.each(['prepare', 'estimate'] as const)(
    'retries a preloaded %s failure on Review open without rebuilding the order',
    async (failure) => {
      if (failure === 'prepare')
        mockPrepareUnsignedTx.mockRejectedValueOnce(new Error('offline'));
      else mockEstimateFee.mockRejectedValueOnce(new Error('offline'));
      const { result, store } = renderPreview();
      const cache = createSwapReviewPreloadWithBuildCache<
        ISwapPreparedBuild,
        ISwapPreparedReview
      >();
      const key = getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      );
      const task = cache.preload(
        key,
        result.current.getReviewBuildKey(quote),
        (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
        (preparedBuild, isCurrent) =>
          result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
      );
      const prepared = await task.promise;
      expect(prepared.status).toBe('failed');
      if (prepared.status === 'failed') {
        expect(prepared.feeError).toBeInstanceOf(Error);
      }
      expect(prepared.buildResult.orderId).toBe('review-repro-98');
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
      expect(mockEstimateFee).toHaveBeenCalledTimes(
        failure === 'prepare' ? 1 : 2,
      );
      expect(
        store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
      ).toBeUndefined();
      await act(async () => {
        store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
        });
      });
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
      expect(mockEstimateFee).toHaveBeenCalledTimes(
        failure === 'prepare' ? 2 : 3,
      );
      expect(
        store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos,
      ).toHaveLength(1);
    },
  );

  it.each(['pending', 'fulfilled'] as const)(
    'keeps the successful %s estimate when native balance blocks confirmation',
    async (timing) => {
      const fee = pendingValue<unknown>();
      mockEstimateFee.mockReturnValueOnce(fee.promise);
      mockFetchBalance.mockResolvedValue([{ balanceParsed: '0.1' }]);
      jest.mocked(Toast.error).mockClear();
      const showError = jest
        .spyOn(errorToastUtils, 'showToastOfError')
        .mockImplementation(() => undefined);
      try {
        const { result, store } = renderPreview();
        const cache = createSwapReviewPreloadWithBuildCache<
          ISwapPreparedBuild,
          ISwapPreparedReview
        >();
        const key = getSwapReviewPreparationKey(
          quote,
          result.current.reviewPreparationContextKey,
        );
        const task = cache.preload(
          key,
          result.current.getReviewBuildKey(quote),
          (isCurrent) =>
            result.current.prepareSwapReviewBuild(quote, isCurrent),
          (preparedBuild, isCurrent) =>
            result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
        );
        await waitFor(() => expect(mockEstimateFee).toHaveBeenCalledTimes(1));
        if (timing === 'fulfilled') {
          fee.resolve(previewFee);
          await task.promise;
        }
        expect(Toast.error).not.toHaveBeenCalled();
        expect(showError).not.toHaveBeenCalled();
        const claimed = cache.claim(
          key,
          result.current.getReviewBuildKey(quote),
          (isCurrent) =>
            result.current.prepareSwapReviewBuild(quote, isCurrent),
          (preparedBuild, isCurrent) =>
            result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
        );
        expect(claimed.promise).toBe(task.promise);
        await act(async () => {
          const preview = result.current.preSwapBeforeStepActions(
            quote,
            fromToken,
            toToken,
            claimed,
          );
          expect(
            result.current.preSwapBeforeStepActions(
              quote,
              fromToken,
              toToken,
              claimed,
            ),
          ).toBe(preview);
          fee.resolve(previewFee);
          await preview;
          expect(
            result.current.preSwapBeforeStepActions(
              quote,
              fromToken,
              toToken,
              claimed,
            ),
          ).toBe(preview);
        });
        expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
        expect(mockEstimateFee).toHaveBeenCalledTimes(1);
        expect(store.get(swapStepsAtom()).preSwapData).toMatchObject({
          stepBeforeActionsLoading: false,
          stepBeforeActionsError: true,
        });
        expect(
          store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos,
        ).toHaveLength(1);
        expect(Toast.error).toHaveBeenCalledTimes(1);
        expect(showError).not.toHaveBeenCalled();
      } finally {
        showError.mockRestore();
      }
    },
  );

  it('keeps fees visible and confirmation blocked on cold Preview and a slippage rebuild when native balance is insufficient', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0.1' }]);
    jest.mocked(Toast.error).mockClear();
    const { result, store } = renderPreview();
    await act(async () => {
      await result.current.preSwapBeforeStepActions(quote, fromToken, toToken);
    });
    expect(store.get(swapStepsAtom()).preSwapData).toMatchObject({
      stepBeforeActionsError: true,
      stepBeforeActionsLoading: false,
      estimateNetworkFeeLoading: false,
    });
    expect(
      store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos,
    ).toHaveLength(1);
    expect(Toast.error).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.rebuildSwapWithSlippage({ slippagePercentage: 2 });
    });
    expect(store.get(swapStepsAtom()).preSwapData).toMatchObject({
      slippage: 2,
      stepBeforeActionsError: true,
      stepBeforeActionsLoading: false,
      estimateNetworkFeeLoading: false,
    });
    expect(
      store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos,
    ).toHaveLength(1);
    expect(Toast.error).toHaveBeenCalledTimes(2);
    expect(mockNavigateTxConfirm).not.toHaveBeenCalled();
  });

  it('uses the latest fee level through the callback retained by an already open Preview', async () => {
    mockEstimateFee.mockResolvedValue({
      ...previewFee,
      gas: [
        { gasPrice: '1', gasLimit: '21000' },
        { gasPrice: '2', gasLimit: '21000' },
        { gasPrice: '3', gasLimit: '21000' },
      ],
    });
    const { result, store } = renderPreview();
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const task = cache.preload(
      getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      ),
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    await task.promise;
    const originalHandler = result.current.preSwapBeforeStepActions;
    await act(async () => {
      await originalHandler(quote, fromToken, toToken, task);
    });
    await act(async () => {
      store.set(swapStepNetFeeLevelAtom(), {
        networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      });
    });
    await act(async () => {
      await originalHandler(quote, fromToken, toToken, task);
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(2);
    expect(
      store.get(swapStepsAtom()).preSwapData.stepBeforeActionsLoading,
    ).toBe(false);
    expect(
      store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos?.[0].gasInfo
        .gas?.gasPrice,
    ).toBe('3');
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 31_000);
    try {
      await act(async () => {
        store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
        });
      });
      await act(async () => {
        await originalHandler(quote, fromToken, toToken, task);
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
      expect(mockEstimateFee).toHaveBeenCalledTimes(3);
      expect(
        store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos?.[0].gasInfo
          .gas?.gasPrice,
      ).toBe('2');
    } finally {
      clock.mockRestore();
    }
  });

  it('rebuilds an expired preparation instead of reusing a matching cached Review order', async () => {
    const { result, store } = renderPreview();
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const task = cache.preload(
      getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      ),
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    const prepared = await task.promise;
    await act(async () => {
      store.set(swapStepsAtom(), (previous) => ({
        ...previous,
        preSwapData: {
          ...previous.preSwapData,
          swapBuildResultData: prepared.buildResult,
        },
      }));
    });
    mockFetchBuildTx.mockResolvedValueOnce(buildResponse('95'));
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(prepared.builtAt + 31_000);
    try {
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
      expect(
        store.get(swapStepsAtom()).preSwapData.swapBuildResultData?.orderId,
      ).toBe('review-repro-95');
    } finally {
      clock.mockRestore();
    }
  });
  it('preserves the business reason for a preloaded input balance failure', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0' }]);
    const { result } = renderPreview();
    const task = result.current.prepareSwapReviewBuild(quote, () => true);
    await expect(task).rejects.not.toThrow(
      'checkLatestFromTokenBalance failed',
    );
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
  });

  it('one foreground validation failure produces only one business toast', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0' }]);
    jest.mocked(Toast.error).mockClear();
    const feeQuote = {
      ...quote,
      fee: {
        ...quote.fee,
        percentageFee: quote.fee?.percentageFee ?? 0,
        otherFeeInfos: [
          { token: { ...fromToken, price: '1000' }, amount: '0.01' },
        ],
      },
    };
    const { result } = renderPreview(feeQuote);
    await act(async () => {
      await result.current.preSwapBeforeStepActions(
        feeQuote,
        fromToken,
        toToken,
      );
    });
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledTimes(1);
  });

  it('a recovered balance can reuse the fee without preserving an obsolete block', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0.1' }]);
    const { result, store } = renderPreview();
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const task = cache.preload(
      getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      ),
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    const prepared = await task.promise;
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '100' }]);
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(prepared.preparedAt + 6000);
    try {
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
      });
      expect(mockEstimateFee).toHaveBeenCalledTimes(1);
      expect(
        store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
      ).toBeUndefined();
    } finally {
      clock.mockRestore();
    }
  });

  it('rechecks a rejected balance preparation and builds only after recovery', async () => {
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '0' }]);
    const { result, store } = renderPreview();
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const task = cache.preload(
      getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      ),
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    await expect(task.promise).rejects.toMatchObject({
      warning: { title: expect.any(String) },
    });
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    mockFetchBalance.mockResolvedValue([{ balanceParsed: '100' }]);
    await act(async () => {
      await result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
        task,
      );
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(
      store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
    ).toBeUndefined();
  });

  it.each([true, false, undefined])(
    'retries a rejected preload without replaying its Toast: autoToast=%s',
    async (autoToast) => {
      const error = Object.assign(new Error('provider unavailable'), {
        autoToast,
        key: 'global.unknown_error_retry_message',
        info: { provider: 'test' },
        requestId: 'preview-test',
      });
      mockFetchBuildTx.mockRejectedValueOnce(error);
      const { result } = renderPreview();
      const cache = createSwapReviewPreloadWithBuildCache<
        ISwapPreparedBuild,
        ISwapPreparedReview
      >();
      const task = cache.preload(
        getSwapReviewPreparationKey(
          quote,
          result.current.reviewPreparationContextKey,
        ),
        result.current.getReviewBuildKey(quote),
        (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
        (preparedBuild, isCurrent) =>
          result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
      );
      await expect(task.promise).rejects.toMatchObject({
        name: 'buildSwapApi',
        requestId: 'preview-test',
        info: { provider: 'test' },
        ...(autoToast !== undefined ? { autoToast } : {}),
      });
      expect(error.autoToast).toBe(autoToast);
      const show = jest
        .spyOn(errorToastUtils, 'showToastOfError')
        .mockImplementation(() => undefined);
      try {
        await act(async () => {
          await result.current.preSwapBeforeStepActions(
            quote,
            fromToken,
            toToken,
            task,
          );
          await result.current.preSwapBeforeStepActions(
            quote,
            fromToken,
            toToken,
            task,
          );
        });
        expect(show).not.toHaveBeenCalled();
        expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
      } finally {
        show.mockRestore();
      }
    },
  );

  it.each(['build', 'fee'] as const)(
    'changes fees during pending %s without creating a second order',
    async (phase) => {
      const build = pendingValue<IFetchBuildTxResponse>();
      const fee = pendingValue<typeof previewFee>();
      const feeStarted = pendingValue<void>();
      mockEstimateFee.mockResolvedValue({
        ...previewFee,
        gas: [1, 2, 3].map((price) => ({
          gasPrice: String(price),
          gasLimit: '21000',
        })),
      });
      if (phase === 'build')
        mockFetchBuildTx.mockReturnValueOnce(build.promise);
      if (phase === 'fee')
        mockEstimateFee.mockImplementationOnce(() => {
          feeStarted.resolve();
          return fee.promise;
        });
      const { result, store } = renderPreview();
      const cache = createSwapReviewPreloadWithBuildCache<
        ISwapPreparedBuild,
        ISwapPreparedReview
      >();
      const task = cache.claim(
        getSwapReviewPreparationKey(
          quote,
          result.current.reviewPreparationContextKey,
        ),
        result.current.getReviewBuildKey(quote),
        (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
        (preparedBuild, isCurrent) =>
          result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
      );
      let first: Promise<void> | undefined;
      await act(async () => {
        first = result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
        if (phase === 'fee') await feeStarted.promise;
      });
      await act(async () => {
        store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
        });
      });
      let second: Promise<void> | undefined;
      await act(async () => {
        second = result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
        if (phase === 'build') build.resolve(buildResponse('98'));
        await second;
      });
      if (phase === 'fee') fee.resolve(previewFee);
      await act(async () => {
        await first;
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
      expect(mockEstimateFee).toHaveBeenCalledTimes(phase === 'build' ? 1 : 2);
      expect(
        store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
      ).toBeUndefined();
      expect(
        store.get(swapStepsAtom()).preSwapData.netWorkFee?.gasInfos?.[0].gasInfo
          .gas?.gasPrice,
      ).toBe('3');
      cache.clear();
    },
  );

  it('keeps the cold build error identity shared with the delayed proxy Toast', async () => {
    const error = Object.assign(new Error('cold provider unavailable'), {
      autoToast: true,
    });
    mockFetchBuildTx.mockRejectedValueOnce(error);
    const coldQuote = {
      ...quote,
      fromTokenInfo: { ...fromToken, networkId: 'sol--101' },
    };
    const { result } = renderPreview(coldQuote);
    const shown = new Set<unknown>();
    const show = jest
      .spyOn(errorToastUtils, 'showToastOfError')
      .mockImplementation((value) => {
        shown.add(value);
        return false;
      });
    try {
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          coldQuote,
          coldQuote.fromTokenInfo,
          toToken,
        );
      });
      expect(show.mock.calls[0][0]).toBe(error);
      errorToastUtils.showToastOfError(error);
      expect(shown.size).toBe(1);
      expect(error.name).toBe('buildSwapApi');
    } finally {
      show.mockRestore();
    }
  });

  it('does not create a replacement order when a pending fee fails after build expiry', async () => {
    const fee = pendingValue<typeof previewFee>();
    mockEstimateFee.mockReturnValueOnce(fee.promise);
    const { result, store } = renderPreview();
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const task = cache.claim(
      getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      ),
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    await waitFor(() => expect(mockEstimateFee).toHaveBeenCalledTimes(1));
    let review: Promise<void> | undefined;
    await act(async () => {
      review = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
        task,
      );
    });
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    const show = jest
      .spyOn(errorToastUtils, 'showToastOfError')
      .mockImplementation(() => false);
    try {
      await act(async () => {
        fee.reject(new Error('slow fee failure'));
        await review;
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
      expect(mockEstimateFee).toHaveBeenCalledTimes(1);
      expect(show).toHaveBeenCalledTimes(1);
      expect(
        store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
      ).toBe(true);
    } finally {
      clock.mockRestore();
      show.mockRestore();
      cache.clear();
    }
  });

  it('keeps the replacement build shared when fees change twice after expiry', async () => {
    const oldFee = pendingValue<typeof previewFee>();
    const replacement = pendingValue<IFetchBuildTxResponse>();
    const replacementStarted = pendingValue<void>();
    mockEstimateFee.mockReturnValueOnce(oldFee.promise);
    const { result, store } = renderPreview();
    const cache = createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >();
    const task = cache.claim(
      getSwapReviewPreparationKey(
        quote,
        result.current.reviewPreparationContextKey,
      ),
      result.current.getReviewBuildKey(quote),
      (isCurrent) => result.current.prepareSwapReviewBuild(quote, isCurrent),
      (preparedBuild, isCurrent) =>
        result.current.prepareSwapReview(quote, isCurrent, preparedBuild),
    );
    const built = await task.build.promise;
    let first: Promise<void> | undefined;
    await act(async () => {
      first = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
        task,
      );
    });
    mockFetchBuildTx.mockImplementationOnce(() => {
      replacementStarted.resolve();
      return replacement.promise;
    });
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(built.builtAt + 31_000);
    try {
      await act(async () => {
        store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
        });
      });
      let second: Promise<void> | undefined;
      await act(async () => {
        second = result.current.preSwapBeforeStepActions(
          quote,
          fromToken,
          toToken,
          task,
        );
        await replacementStarted.promise;
      });
      await act(async () => {
        store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.LOW,
        });
      });
      let third: Promise<void> | undefined;
      let thirdFinished = false;
      await act(async () => {
        third = result.current
          .preSwapBeforeStepActions(quote, fromToken, toToken, task)
          .then(() => {
            thirdFinished = true;
          });
      });
      expect(thirdFinished).toBe(false);
      expect(
        store.get(swapStepsAtom()).preSwapData.stepBeforeActionsLoading,
      ).toBe(true);
      expect(
        store.get(swapStepsAtom()).preSwapData.swapBuildResultData,
      ).toBeUndefined();
      await act(async () => {
        replacement.resolve(buildResponse('90'));
        await Promise.all([second, third]);
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(2);
      expect(
        store.get(swapStepsAtom()).preSwapData.swapBuildResultData?.orderId,
      ).toBe('review-repro-90');
      expect(
        store.get(swapStepsAtom()).preSwapData.stepBeforeActionsError,
      ).toBeUndefined();
      oldFee.resolve(previewFee);
      await act(async () => {
        await first;
      });
      expect(
        store.get(swapStepsAtom()).preSwapData.swapBuildResultData?.orderId,
      ).toBe('review-repro-90');
    } finally {
      clock.mockRestore();
      cache.clear();
    }
  });

  it('does not build after unmount while the input balance gate is still pending', async () => {
    const balance = pendingValue<{ balanceParsed: string }[]>();
    mockFetchBalance.mockReturnValueOnce(balance.promise);
    const { result, unmount } = renderPreview();
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
    });
    unmount();
    await act(async () => {
      balance.resolve([{ balanceParsed: '100' }]);
      await pending;
    });
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    expect(mockEstimateFee).not.toHaveBeenCalled();
    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('cannot resurrect old build waiters after closing and opening a new Review', async () => {
    const balance = pendingValue<{ balanceParsed: string }[]>();
    mockFetchBalance.mockReturnValueOnce(balance.promise);
    const { result, store } = renderPreview();
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    await act(async () => {
      first = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
    });
    await act(async () => {
      store.set(swapStepNetFeeLevelAtom(), {
        networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      });
    });
    await act(async () => {
      second = result.current.preSwapBeforeStepActions(
        quote,
        fromToken,
        toToken,
      );
    });
    const nextQuote = {
      ...quote,
      quoteId: 'new-session-quote',
      fromAmount: '0.2',
    };
    await act(async () => {
      result.current.endGasAccountReviewSession();
      result.current.beginGasAccountReviewSession();
      store.set(swapStepsAtom(), {
        steps: [],
        quoteResult: nextQuote,
        preSwapData: { fromToken, toToken, slippage: 1 },
      });
    });
    await act(async () => {
      await result.current.preSwapBeforeStepActions(
        nextQuote,
        fromToken,
        toToken,
      );
    });
    const latest = store.get(swapStepsAtom());
    await act(async () => {
      balance.resolve([{ balanceParsed: '0' }]);
      await Promise.all([first, second]);
    });
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockFetchBuildTx.mock.calls[0][0]).toMatchObject({
      fromTokenAmount: '0.2',
    });
    expect(store.get(swapStepsAtom())).toEqual(latest);
    expect(Toast.error).not.toHaveBeenCalled();
  });

  it('preserves the user Custom slippage context when an expired Review build is replaced', async () => {
    const autoQuote = {
      ...quote,
      quoteResultCtx: { okxQuoteResultCtx: { slippageType: 'Auto' as const } },
    };
    const { result, store } = renderPreview(autoQuote);
    await act(async () => {
      await result.current.preSwapBeforeStepActions(
        autoQuote,
        fromToken,
        toToken,
      );
    });
    await act(async () => {
      await result.current.rebuildSwapWithSlippage({ slippagePercentage: 2 });
    });
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 31_000);
    try {
      await act(async () => {
        store.set(swapStepNetFeeLevelAtom(), {
          networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
        });
      });
      const rebuiltQuote = store.get(swapStepsAtom()).quoteResult;
      await act(async () => {
        await result.current.preSwapBeforeStepActions(
          rebuiltQuote,
          fromToken,
          toToken,
        );
      });
      expect(mockFetchBuildTx).toHaveBeenCalledTimes(3);
      expect(mockFetchBuildTx.mock.calls[2][0]).toMatchObject({
        slippagePercentage: 2,
        quoteResultCtx: { okxQuoteResultCtx: { slippageType: 'Custom' } },
      });
    } finally {
      clock.mockRestore();
    }
  });
  it.each(['btc--0', 'sol--101', 'sui--mainnet', 'xrp--0', 'tron--0'])(
    'rejects direct preparation for %s before issuing any background task',
    async (networkId) => {
      const { result } = renderPreview();
      const candidate = {
        ...quote,
        fromTokenInfo: { ...fromToken, networkId },
      };
      await expect(
        result.current.prepareSwapReviewBuild(candidate, () => true),
      ).rejects.toThrow('source network');
      await expect(
        result.current.prepareSwapReview(
          candidate,
          () => true,
          Promise.resolve({ buildResult: {}, builtAt: Date.now() }),
        ),
      ).rejects.toThrow('source network');
      expect(mockFetchBuildTx).not.toHaveBeenCalled();
      expect(mockEstimateFee).not.toHaveBeenCalled();
    },
  );
});
