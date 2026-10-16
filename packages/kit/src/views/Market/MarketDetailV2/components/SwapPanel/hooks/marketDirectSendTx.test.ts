import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import evmSettings from '@onekeyhq/kit-bg/src/vaults/impls/evm/settings';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEstimateGasParams } from '@onekeyhq/shared/types/fee';
import {
  EProtocolOfExchange,
  ESwapNetworkFeeLevel,
} from '@onekeyhq/shared/types/swap/types';

const mockPrepareSendConfirmUnsignedTx = jest.fn();
const mockBuildUnsignedTx = jest.fn();
const mockGetVaultSettings = jest.fn();
const mockBuildEstimateFeeParams = jest.fn();
const mockBatchEstimateFee = jest.fn();
const mockEstimateFee = jest.fn();
const mockUpdateUnsignedTx = jest.fn();
const mockPrecheckUnsignedTxs = jest.fn();
const mockVerifyTransaction = jest.fn();
const mockSignAndSendTransaction = jest.fn();
const mockBuildDecodedTx = jest.fn();
const mockSaveSendConfirmHistoryTxs = jest.fn();
const mockPreActionsBeforeSending = jest.fn();
const mockAfterSendTxAction = jest.fn();
const mockFetchSwapTokenDetails = jest.fn();
const mockGetNativeTokenAddress = jest.fn();
const mockGasAccountDecision = jest.fn();
const mockGasAccountAction = jest.fn();
const mockGetCustomRpcForNetwork = jest.fn();
const mockSwapEstimateFee = jest.fn();
const mockSwapSendTx = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    swap: {
      swapEstimateFee: { swapEstimateFee: mockSwapEstimateFee },
      swapSendTx: { swapSendTx: mockSwapSendTx },
      swapReview: {
        swapReviewOpen: jest.fn(),
        swapReviewReady: jest.fn(),
        swapReviewConfirm: jest.fn(),
        swapReviewClose: jest.fn(),
      },
    },
    transaction: {
      send: {
        gasAccountDecision: mockGasAccountDecision,
        gasAccountAction: mockGasAccountAction,
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSend: {
      buildUnsignedTx: mockBuildUnsignedTx,
      prepareSendConfirmUnsignedTx: mockPrepareSendConfirmUnsignedTx,
      updateUnsignedTx: mockUpdateUnsignedTx,
      precheckUnsignedTxs: mockPrecheckUnsignedTxs,
      signAndSendTransaction: mockSignAndSendTransaction,
      buildDecodedTx: mockBuildDecodedTx,
    },
    serviceNetwork: {
      getVaultSettings: mockGetVaultSettings,
    },
    serviceGas: {
      buildEstimateFeeParams: mockBuildEstimateFeeParams,
      batchEstimateFee: mockBatchEstimateFee,
      estimateFee: mockEstimateFee,
    },
    serviceTransaction: {
      verifyTransaction: mockVerifyTransaction,
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: mockSaveSendConfirmHistoryTxs,
    },
    serviceSignatureConfirm: {
      preActionsBeforeSending: mockPreActionsBeforeSending,
      afterSendTxAction: mockAfterSendTxAction,
    },
    serviceSwap: {
      fetchSwapTokenDetails: mockFetchSwapTokenDetails,
    },
    serviceToken: {
      getNativeTokenAddress: mockGetNativeTokenAddress,
    },
    serviceCustomRpc: {
      getCustomRpcForNetwork: mockGetCustomRpcForNetwork,
    },
  },
}));

const {
  buildMarketPresetFeeEstimateFakeTransferInfo,
  estimateMarketPresetGasFeeFiatValues,
  estimateMarketApproveGasInfos,
  estimateMarketDirectGasInfos,
  sendMarketDirectUnsignedTxs,
} = require('./marketDirectSendTx') as typeof import('./marketDirectSendTx');
const { createSwapReviewAnalytics } =
  require('@onekeyhq/kit/src/views/Swap/utils/swapReviewAnalytics') as typeof import('@onekeyhq/kit/src/views/Swap/utils/swapReviewAnalytics');

function createUnsignedTx(
  overrides: Partial<IUnsignedTxPro> = {},
): IUnsignedTxPro {
  return {
    encodedTx: {
      data: '0xencoded',
    } as never,
    nonce: 1,
    ...overrides,
  } as IUnsignedTxPro;
}

function createEstimateFeeResult() {
  return {
    common: {
      feeDecimals: 18,
      feeSymbol: 'ETH',
      nativeDecimals: 18,
      nativeSymbol: 'ETH',
      nativeTokenPrice: 3000,
    },
    gas: [
      {
        gasPrice: '1',
        gasLimit: '21000',
      },
      {
        gasPrice: '2',
        gasLimit: '22000',
      },
      {
        gasPrice: '3',
        gasLimit: '23000',
      },
    ],
  };
}

function createSponsoredUnsignedTx() {
  const fromTokenInfo = {
    networkId: 'evm--1',
    contractAddress: '0xtoken',
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  };
  const toTokenInfo = {
    networkId: 'evm--1',
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
  };
  return createUnsignedTx({
    swapInfo: {
      reviewAnalyticsContext: {
        reviewSessionId: 'market-session',
        quoteId: 'quote-id',
        orderId: 'order-id',
      },
      sender: {
        amount: '10',
        token: fromTokenInfo,
      },
      receiver: {
        amount: '0.003',
        token: toTokenInfo,
      },
      receivingAddress: '0xuser',
      swapBuildResData: {
        orderId: 'order-id',
        result: {
          fromTokenInfo,
          toTokenInfo,
          gasAccountEnabled: true,
          info: { provider: 'provider', providerName: 'Provider' },
          quoteId: 'quote-id',
          slippage: 0.5,
        },
      },
    } as never,
  });
}

function createSponsoredEstimateFeeResult(quoteId: string) {
  return {
    ...createEstimateFeeResult(),
    payer: 'gasAccount',
    gasAccountEligible: true,
    gasAccountQuote: {
      quoteId,
      maxFee: '0.01',
      expiresAt: '2026-08-10T12:00:00.000Z',
    },
  };
}

function createProviderGasUnsignedTx() {
  const unsignedTx = createSponsoredUnsignedTx();
  if (!unsignedTx.swapInfo) {
    throw new OneKeyLocalError('Swap fixture requires swapInfo');
  }
  const providerResult = {
    ...unsignedTx.swapInfo.swapBuildResData.result,
    originalGasLimit: 160_648,
    gasLimitRate: 1.5,
    gasLimit: 240_972,
  };
  unsignedTx.swapInfo.swapBuildResData.result = providerResult;
  return unsignedTx;
}

function createProviderGasFeeResult() {
  const fee = createEstimateFeeResult();
  return {
    ...fee,
    gas: fee.gas.map((tier) => ({
      ...tier,
      gasLimit: '240972',
      gasLimitForDisplay: '240972',
    })),
  };
}

function createMarketPresetToken(overrides = {}) {
  return {
    contractAddress: '',
    decimals: 18,
    isNative: true,
    networkId: 'evm--1',
    symbol: 'ETH',
    ...overrides,
  };
}

describe('marketDirectSendTx', () => {
  beforeEach(() => {
    mockSwapEstimateFee.mockReset();
    mockSwapSendTx.mockReset();
    mockPrepareSendConfirmUnsignedTx.mockReset();
    mockBuildUnsignedTx.mockReset();
    mockGetVaultSettings.mockReset();
    mockBuildEstimateFeeParams.mockReset();
    mockBatchEstimateFee.mockReset();
    mockEstimateFee.mockReset();
    mockUpdateUnsignedTx.mockReset();
    mockPrecheckUnsignedTxs.mockReset();
    mockVerifyTransaction.mockReset();
    mockSignAndSendTransaction.mockReset();
    mockBuildDecodedTx.mockReset();
    mockSaveSendConfirmHistoryTxs.mockReset();
    mockPreActionsBeforeSending.mockReset();
    mockAfterSendTxAction.mockReset();
    mockFetchSwapTokenDetails.mockReset();
    mockGetNativeTokenAddress.mockReset();
    mockGasAccountDecision.mockReset();
    mockGasAccountAction.mockReset();
    mockGetCustomRpcForNetwork.mockReset();

    mockGetVaultSettings.mockResolvedValue({});
    mockBuildUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockBuildEstimateFeeParams.mockImplementation(async ({ encodedTx }) => ({
      encodedTx,
    }));
    mockEstimateFee.mockResolvedValue(createEstimateFeeResult());
    mockUpdateUnsignedTx.mockImplementation(async ({ unsignedTx }) => {
      return unsignedTx as never;
    });
    mockPrecheckUnsignedTxs.mockResolvedValue(undefined);
    mockVerifyTransaction.mockResolvedValue(undefined);
    mockSignAndSendTransaction.mockResolvedValue({
      txid: '0xtx',
      rawTx: '0xraw',
    });
    mockBuildDecodedTx.mockResolvedValue({
      txid: '0xtx',
      networkId: 'evm--1',
      totalFeeFiatValue: '0.12',
      totalFeeInNative: '0.0001',
    });
    mockSaveSendConfirmHistoryTxs.mockResolvedValue(undefined);
    mockPreActionsBeforeSending.mockResolvedValue(undefined);
    mockAfterSendTxAction.mockResolvedValue(undefined);
    mockFetchSwapTokenDetails.mockResolvedValue([{ balanceParsed: '0.005' }]);
    mockGetNativeTokenAddress.mockResolvedValue('');
    mockGetCustomRpcForNetwork.mockResolvedValue(undefined);
  });

  it.each([
    { mode: 'sequential', expectedCalls: 2 },
    { mode: 'batch', expectedCalls: 1 },
    { mode: 'batch fallback', expectedCalls: 3 },
  ])(
    'attributes approval-only estimates without changing transactions: $mode',
    async ({ mode, expectedCalls }) => {
      const analyticsSwapInfo = createSponsoredUnsignedTx().swapInfo;
      const approvals = [
        createUnsignedTx({
          encodedTx: {
            from: '0xuser',
            to: '0xtoken',
            value: '0x0',
            data: '0xreset',
          },
        }),
        createUnsignedTx({
          encodedTx: {
            from: '0xuser',
            to: '0xtoken',
            value: '0x0',
            data: '0xapprove',
          },
        }),
      ];
      mockGetVaultSettings.mockResolvedValue({
        supportBatchEstimateFee: { 'evm--1': mode !== 'sequential' },
      });
      const fee = createEstimateFeeResult();
      mockBatchEstimateFee.mockResolvedValue({
        common: fee.common,
        txFees: mode === 'batch fallback' ? [] : [fee, fee],
      });

      await estimateMarketApproveGasInfos({
        analyticsSwapInfo,
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        approveUnsignedTxArr: approvals,
      });

      expect(mockSwapEstimateFee).toHaveBeenCalledTimes(expectedCalls);
      for (const [event] of mockSwapEstimateFee.mock.calls) {
        expect(event).toEqual(
          expect.objectContaining({
            reviewSessionId: 'market-session',
            quoteId: 'quote-id',
            orderId: 'order-id',
            status: 'success',
          }),
        );
      }
      expect(approvals.every((tx) => tx.swapInfo === undefined)).toBe(true);
      expect(mockPrepareSendConfirmUnsignedTx).not.toHaveBeenCalled();
      expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
    },
  );

  it('reports a failing approval estimate with the owning review context', async () => {
    const error = new Error('estimate unavailable');
    mockEstimateFee.mockRejectedValue(error);
    await expect(
      estimateMarketApproveGasInfos({
        analyticsSwapInfo: createSponsoredUnsignedTx().swapInfo,
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        approveUnsignedTxArr: [createUnsignedTx()],
      }),
    ).rejects.toBe(error);
    expect(mockSwapEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSwapEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        reviewSessionId: 'market-session',
        message: 'Unknown error',
      }),
    );
  });

  it('times parallel fee parameter preparation once and excludes vault settings', async () => {
    let time = 0;
    const analytics = createSwapReviewAnalytics({ clock: () => time });
    analytics.open({
      swapProvider: 'provider',
      swapType: 'swap',
      sourceChain: 'evm--1',
      receivedChain: 'evm--1',
      sourceTokenSymbol: 'USDC',
      receivedTokenSymbol: 'ETH',
      createFrom: 'marketDex',
      walletType: 'hd',
      supportPreBuild: true,
      needApprove: true,
    });
    const reviewPreparation = analytics.beginPreparation();
    const pendingParams: (() => void)[] = [];
    let notifyParamsStarted!: () => void;
    const paramsStarted = new Promise<void>((resolve) => {
      notifyParamsStarted = resolve;
    });
    mockGetVaultSettings.mockImplementation(async () => {
      time += 100;
      return { supportBatchEstimateFee: { 'evm--1': true } };
    });
    mockBuildEstimateFeeParams.mockImplementation(
      ({ encodedTx }) =>
        new Promise((resolve) => {
          pendingParams.push(() => resolve({ encodedTx }));
          if (pendingParams.length === 2) notifyParamsStarted();
        }),
    );
    mockBatchEstimateFee.mockImplementation(async () => {
      time += 20;
      const fee = createEstimateFeeResult();
      return { common: fee.common, txFees: [fee, fee] };
    });
    const pending = estimateMarketApproveGasInfos({
      reviewPreparation,
      analyticsSwapInfo: createSponsoredUnsignedTx().swapInfo,
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      approveUnsignedTxArr: [createUnsignedTx(), createUnsignedTx()],
    });
    await paramsStarted;
    time += 10;
    pendingParams.forEach((resolve) => resolve());
    await pending;
    expect(reviewPreparation?.timings.estimateFeeMs).toBe(30);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'rpc failure', 'history failure'])(
    'keeps direct send telemetry at the broadcast boundary: %s',
    async (scenario) => {
      const unsignedTx = createSponsoredUnsignedTx();
      mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
      const error = new Error(scenario);
      if (scenario === 'history failure') {
        mockSaveSendConfirmHistoryTxs.mockRejectedValue(error);
      } else {
        mockSignAndSendTransaction.mockRejectedValue(error);
      }
      await expect(
        sendMarketDirectUnsignedTxs({
          shouldReportSendError: (failure) =>
            failure !== error || scenario !== 'cancel',
          accountAddress: '0xuser',
          accountId: 'account-1',
          networkId: 'evm--1',
          buildUnsignedParams: {
            accountId: 'account-1',
            networkId: 'evm--1',
            swapInfo: unsignedTx.swapInfo,
          },
        }),
      ).rejects.toBe(error);
      if (scenario === 'cancel') {
        expect(mockSwapSendTx).not.toHaveBeenCalled();
      } else {
        expect(mockSwapSendTx).toHaveBeenCalledTimes(1);
        expect(mockSwapSendTx).toHaveBeenCalledWith(
          expect.objectContaining({
            reviewSessionId: 'market-session',
            status: scenario === 'history failure' ? 'success' : 'fail',
          }),
        );
      }
      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('builds market preset fake transfer info as an isolated self-transfer', () => {
    const transferInfo = buildMarketPresetFeeEstimateFakeTransferInfo({
      accountAddress: '0xuser',
      amount: '',
      token: createMarketPresetToken(),
    });

    expect(transferInfo).toEqual({
      amount: '0',
      from: '0xuser',
      to: '0xuser',
      tokenInfo: {
        address: '',
        decimals: 18,
        isNative: true,
        logoURI: undefined,
        name: 'ETH',
        networkId: 'evm--1',
        symbol: 'ETH',
      },
    });

    expect(
      buildMarketPresetFeeEstimateFakeTransferInfo({
        accountAddress: '0xuser',
        token: createMarketPresetToken({
          contractAddress: '',
          isNative: false,
          symbol: 'USDT',
        }),
      }),
    ).toBeUndefined();
  });

  it('estimates market preset fees from the isolated fake unsigned tx', async () => {
    const fakeEncodedTx = { data: '0xfake-preset' };
    const transferInfo = buildMarketPresetFeeEstimateFakeTransferInfo({
      accountAddress: '0xuser',
      token: createMarketPresetToken(),
    });
    mockBuildUnsignedTx.mockResolvedValue(
      createUnsignedTx({
        encodedTx: fakeEncodedTx as IUnsignedTxPro['encodedTx'],
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        txSize: 123,
      }),
    );

    const result = await estimateMarketPresetGasFeeFiatValues({
      accountAddress: '0xuser',
      accountId: 'account-1',
      amount: '',
      items: [{ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM }],
      networkId: 'evm--1',
      token: createMarketPresetToken(),
    });

    expect(mockBuildUnsignedTx).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
      transfersInfo: [
        expect.objectContaining({
          amount: '0',
          from: '0xuser',
          to: '0xuser',
        }),
      ],
    });
    expect(mockBuildEstimateFeeParams).toHaveBeenCalledWith({
      accountId: 'account-1',
      encodedTx: fakeEncodedTx,
      networkId: 'evm--1',
    });
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        accountAddress: '0xuser',
        accountId: 'account-1',
        encodedTx: fakeEncodedTx,
        networkId: 'evm--1',
        scenario: 'swap',
        transfersInfo: transferInfo ? [transferInfo] : undefined,
      }),
    );
    expect(result[0]).toBeDefined();
  });

  it('falls back to fee-rate preset estimation when fake tx cannot be built', async () => {
    mockBuildUnsignedTx.mockRejectedValueOnce(new Error('fake tx failed'));

    const result = await estimateMarketPresetGasFeeFiatValues({
      accountAddress: '0xuser',
      accountId: 'account-1',
      items: [{ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM }],
      networkId: 'evm--1',
      token: createMarketPresetToken(),
    });

    expect(mockBuildEstimateFeeParams).toHaveBeenCalledWith({
      accountId: 'account-1',
      encodedTx: undefined,
      networkId: 'evm--1',
    });
    expect(result[0]).toBeDefined();
  });

  it('sends a single unsigned tx through the direct sign-and-send path', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());

    const result = await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result).toHaveLength(1);
    expect(mockPrepareSendConfirmUnsignedTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(mockSaveSendConfirmHistoryTxs).toHaveBeenCalledTimes(1);
    expect(mockBatchEstimateFee).not.toHaveBeenCalled();
  });

  it.each([
    { cache: 'missing', fails: false },
    { cache: 'mismatched', fails: false },
    { cache: 'missing', fails: true },
    { cache: 'mismatched', fails: true },
    { cache: 'matching', fails: false },
    { cache: 'legacy', fails: false },
  ])(
    'attributes standalone approval send-time estimates: $cache cache, failure $fails',
    async ({ cache, fails }) => {
      const unsignedTx = createUnsignedTx();
      const analyticsSwapInfo =
        cache === 'legacy' ? undefined : createSponsoredUnsignedTx().swapInfo;
      const buildUnsignedParams = {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: unsignedTx.encodedTx,
        isInternalSwap: true,
      };
      const gasInfos =
        cache === 'matching' || cache === 'mismatched'
          ? [
              {
                encodeTx:
                  cache === 'matching'
                    ? unsignedTx.encodedTx
                    : createUnsignedTx({
                        encodedTx: {
                          from: '0xuser',
                          to: '0xtoken',
                          value: '0',
                          data: '0xstale',
                        },
                      }).encodedTx,
                gasInfo: {
                  common: createEstimateFeeResult().common,
                  gas: createEstimateFeeResult().gas[1],
                },
              },
            ]
          : undefined;
      const error = new Error('approval fee unavailable');
      mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
      if (fails) mockEstimateFee.mockRejectedValue(error);

      const sending = sendMarketDirectUnsignedTxs({
        analyticsSwapInfo,
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        buildUnsignedParams,
        gasInfos,
      });
      if (fails) await expect(sending).rejects.toBe(error);
      else expect(await sending).toHaveLength(1);

      expect(mockEstimateFee).toHaveBeenCalledTimes(
        cache === 'matching' ? 0 : 1,
      );
      expect(mockSwapEstimateFee).toHaveBeenCalledTimes(
        cache === 'matching' || cache === 'legacy' ? 0 : 1,
      );
      if (cache !== 'matching' && cache !== 'legacy') {
        expect(mockSwapEstimateFee).toHaveBeenCalledWith(
          expect.objectContaining({
            reviewSessionId: 'market-session',
            quoteId: 'quote-id',
            orderId: 'order-id',
            status: fails ? 'fail' : 'success',
            ...(fails ? { message: 'Unknown error' } : {}),
          }),
        );
      }
      if (cache !== 'matching') {
        expect(mockEstimateFee).toHaveBeenCalledWith(
          expect.objectContaining({ gasAccountEnabled: false }),
        );
      }
      expect(mockPrepareSendConfirmUnsignedTx).toHaveBeenCalledWith(
        buildUnsignedParams,
      );
      expect(unsignedTx.swapInfo).toBeUndefined();
      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(fails ? 0 : 1);
      if (!fails) {
        expect(
          mockSignAndSendTransaction.mock.calls[0][0].unsignedTx.swapInfo,
        ).toBeUndefined();
      }
      expect(mockSwapSendTx).not.toHaveBeenCalled();
      expect(mockGasAccountAction).not.toHaveBeenCalled();
    },
  );

  it('tracks Gas Account submission success without repeating the review decision', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);
    mockEstimateFee.mockResolvedValue(
      createSponsoredEstimateFeeResult('quote-id'),
    );

    await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: sponsoredUnsignedTx.encodedTx,
        swapInfo: sponsoredUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
      gasAccountAnalytics: {
        fiatCurrency: 'usd',
        nativeBalance: '0.005',
        useGasAccountByDefault: true,
      },
    });

    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();
    expect(mockGasAccountDecision).not.toHaveBeenCalled();
    expect(mockGasAccountAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'submitSucceeded',
        orderId: 'order-id',
      }),
    );
  });

  it('returns the Gas Account decision context with the direct market review estimate', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);
    mockEstimateFee.mockResolvedValue(
      createSponsoredEstimateFeeResult('preview-quote-id'),
    );

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: sponsoredUnsignedTx.encodedTx,
        swapInfo: sponsoredUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
      gasAccountAnalytics: {
        fiatCurrency: 'usd',
        useGasAccountByDefault: true,
      },
    });

    expect(result.gasAccountAnalyticsContext).toEqual(
      expect.objectContaining({
        entryPoint: 'marketSwapDirect',
        scenario: 'swap',
        selectedPayer: 'gasAccount',
        quoteId: 'preview-quote-id',
        orderId: 'order-id',
      }),
    );
    expect(result.gasAccountAnalyticsNativeBalance).toBe('0.005');
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1);
    expect(mockGasAccountDecision).not.toHaveBeenCalled();
  });

  it('requests Gas Account sponsorship for a single swap tx on the default RPC', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);

    await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: sponsoredUnsignedTx.encodedTx,
        swapInfo: sponsoredUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
    });

    expect(mockGetCustomRpcForNetwork).toHaveBeenCalledWith('evm--1');
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({ gasAccountEnabled: true, scenario: 'swap' }),
    );
  });

  it('does not request Gas Account sponsorship when a custom RPC is enabled', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);
    mockGetCustomRpcForNetwork.mockResolvedValue({
      rpc: 'https://rpc.example.com',
      enabled: true,
    });

    await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: sponsoredUnsignedTx.encodedTx,
        swapInfo: sponsoredUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
    });

    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({ gasAccountEnabled: false }),
    );
  });

  describe('provider gas limit', () => {
    beforeEach(() => {
      mockBuildEstimateFeeParams.mockImplementation(
        async ({
          encodedTx,
          gasLimit,
        }: Pick<IEstimateGasParams, 'encodedTx' | 'gasLimit'>) => ({
          encodedTx,
          gasLimit,
        }),
      );
    });

    it('passes buffered provider gas unchanged through preview and final pricing without requesting Gas Account', async () => {
      const unsignedTx = createProviderGasUnsignedTx();
      mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
      mockEstimateFee.mockResolvedValue(createProviderGasFeeResult());
      const params = {
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        buildUnsignedParams: {
          accountId: 'account-1',
          networkId: 'evm--1',
          encodedTx: unsignedTx.encodedTx,
          swapInfo: unsignedTx.swapInfo,
          isInternalSwap: true,
        },
      };

      const preview = await estimateMarketDirectGasInfos(params);
      expect(preview.gasInfos[0].gasInfo.gas?.gasLimit).toBe('240972');
      await sendMarketDirectUnsignedTxs(params);

      expect(mockBuildEstimateFeeParams).toHaveBeenCalledTimes(2);
      expect(mockEstimateFee).toHaveBeenCalledTimes(2);
      for (const call of [1, 2]) {
        expect(mockBuildEstimateFeeParams).toHaveBeenNthCalledWith(
          call,
          expect.objectContaining({ gasLimit: '240972' }),
        );
        expect(mockEstimateFee).toHaveBeenNthCalledWith(
          call,
          expect.objectContaining({
            gasLimit: '240972',
            gasAccountEnabled: false,
          }),
        );
      }
      expect(mockBatchEstimateFee).not.toHaveBeenCalled();
      expect(mockUpdateUnsignedTx).toHaveBeenCalledWith(
        expect.objectContaining({
          feeInfo: expect.objectContaining({
            gas: expect.objectContaining({ gasLimit: '240972' }),
          }),
        }),
      );
      expect(mockSignAndSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ gasAccountUiState: undefined }),
      );
    });

    it('keeps normal estimation when the provider supplies only originalGasLimit', async () => {
      const unsignedTx = createProviderGasUnsignedTx();
      if (!unsignedTx.swapInfo) {
        throw new OneKeyLocalError('Swap fixture requires swapInfo');
      }
      unsignedTx.swapInfo.swapBuildResData.result.gasLimit = undefined;
      mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
      mockEstimateFee.mockResolvedValue(createEstimateFeeResult());
      const params = {
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        buildUnsignedParams: {
          accountId: 'account-1',
          networkId: 'evm--1',
          encodedTx: unsignedTx.encodedTx,
          swapInfo: unsignedTx.swapInfo,
          isInternalSwap: true,
        },
      };

      const preview = await estimateMarketDirectGasInfos(params);
      expect(preview.gasInfos[0].gasInfo.gas?.gasLimit).toBe('22000');
      await sendMarketDirectUnsignedTxs(params);

      expect(mockEstimateFee).toHaveBeenCalledTimes(2);
      for (const call of [1, 2]) {
        expect(mockEstimateFee).toHaveBeenNthCalledWith(
          call,
          expect.objectContaining({ gasLimit: undefined }),
        );
      }
      expect(mockUpdateUnsignedTx).toHaveBeenCalledWith(
        expect.objectContaining({
          feeInfo: expect.objectContaining({
            gas: expect.objectContaining({ gasLimit: '22000' }),
          }),
        }),
      );
    });

    it.each(['sequential', 'batch', 'batch fallback'])(
      'excludes approvals from provider gas and preserves the final swap limit: %s',
      async (mode) => {
        const unsignedTx = createProviderGasUnsignedTx();
        const approvals = ['0xreset', '0xapprove'].map((data, index) =>
          createUnsignedTx({
            encodedTx: { from: '0xuser', to: '0xtoken', value: '0x0', data },
            nonce: index,
            swapInfo: unsignedTx.swapInfo,
            approveInfo: {
              owner: '0xuser',
              spender: '0xrouter',
              amount: index === 0 ? '0' : '10',
            },
          }),
        );
        mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
        mockGetVaultSettings.mockResolvedValue({
          supportBatchEstimateFee: { 'evm--1': mode !== 'sequential' },
        });
        const approvalFee = createEstimateFeeResult();
        mockBatchEstimateFee.mockResolvedValue({
          common: approvalFee.common,
          txFees:
            mode === 'batch fallback'
              ? []
              : [approvalFee, approvalFee, createProviderGasFeeResult()],
        });
        mockEstimateFee
          .mockResolvedValueOnce(approvalFee)
          .mockResolvedValueOnce(approvalFee)
          .mockResolvedValueOnce(createProviderGasFeeResult());

        const result = await estimateMarketDirectGasInfos({
          accountAddress: '0xuser',
          accountId: 'account-1',
          networkId: 'evm--1',
          networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
          buildUnsignedParams: {
            accountId: 'account-1',
            networkId: 'evm--1',
            encodedTx: unsignedTx.encodedTx,
            swapInfo: unsignedTx.swapInfo,
            isInternalSwap: true,
          },
          approveUnsignedTxArr: approvals,
        });

        expect(
          result.gasInfos.map((item) => item.gasInfo.gas?.gasLimit),
        ).toEqual(['22000', '22000', '240972']);
        for (const approval of approvals) {
          expect(mockBuildEstimateFeeParams).toHaveBeenCalledWith(
            expect.objectContaining({
              encodedTx: approval.encodedTx,
              gasLimit: undefined,
            }),
          );
        }
        if (mode === 'sequential') {
          expect(mockBatchEstimateFee).not.toHaveBeenCalled();
        } else {
          expect(mockBatchEstimateFee).toHaveBeenCalledWith(
            expect.objectContaining({
              gasLimits: [undefined, undefined, '240972'],
            }),
          );
        }
        if (mode === 'batch') {
          expect(mockEstimateFee).not.toHaveBeenCalled();
        } else {
          expect(mockEstimateFee).toHaveBeenCalledTimes(3);
          for (const call of [1, 2]) {
            expect(mockEstimateFee).toHaveBeenNthCalledWith(
              call,
              expect.objectContaining({ gasLimit: undefined }),
            );
          }
          expect(mockEstimateFee).toHaveBeenLastCalledWith(
            expect.objectContaining({
              encodedTx: unsignedTx.encodedTx,
              gasLimit: '240972',
              gasAccountEnabled: false,
            }),
          );
        }
      },
    );
  });

  it('does not request Gas Account sponsorship while the review quote still needs an allowance', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);

    await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: sponsoredUnsignedTx.encodedTx,
        swapInfo: sponsoredUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
      quoteResult: {
        allowanceResult: { allowanceTarget: '0xspender', amount: '10' },
      } as never,
    });

    expect(mockGetCustomRpcForNetwork).not.toHaveBeenCalled();
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({ gasAccountEnabled: false }),
    );
  });

  it('reuses the preview gas for a swap sent after a standalone approve instead of re-estimating for sponsorship', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);

    await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: sponsoredUnsignedTx.encodedTx,
        swapInfo: sponsoredUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
      quoteResult: {
        allowanceResult: { allowanceTarget: '0xspender', amount: '10' },
      } as never,
      gasInfos: [
        {
          encodeTx: sponsoredUnsignedTx.encodedTx,
          gasInfo: {
            common: createEstimateFeeResult().common,
            gas: {
              gasPrice: '2',
              gasLimit: '22000',
            },
          } as never,
        },
      ],
    });

    expect(mockEstimateFee).not.toHaveBeenCalled();
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ gasAccountUiState: undefined }),
    );
  });

  it('sends batch approve plus swap with batch fee estimation when supported', async () => {
    const approveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xapprove',
      } as never,
      nonce: 1,
    });
    const swapUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xswap',
      } as never,
      nonce: 2,
    });

    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(swapUnsignedTx);
    mockGetVaultSettings.mockResolvedValue(evmSettings);
    mockBatchEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      txFees: [createEstimateFeeResult(), createEstimateFeeResult()],
    });

    const result = await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xswap',
        } as never,
        isInternalSwap: true,
      },
      approveUnsignedTxArr: [approveUnsignedTx],
    });

    expect(result).toHaveLength(2);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockUpdateUnsignedTx).toHaveBeenCalledTimes(2);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(2);
    expect(mockSaveSendConfirmHistoryTxs).toHaveBeenCalledTimes(2);
  });

  it('bypasses batch estimation for Blast approvals and preserves the built swap gas limit', async () => {
    const networkId = getNetworkIdsMap().blast;
    const fromToken = createMarketPresetToken({
      networkId,
      contractAddress: '0xtoken',
      isNative: false,
      symbol: 'USDC',
      decimals: 6,
    });
    const toToken = createMarketPresetToken({ networkId });
    const approveUnsignedTx = createUnsignedTx({
      encodedTx: {
        from: '0xuser',
        to: '0xtoken',
        value: '0',
        data: '0xapprove',
      },
    });
    const swapUnsignedTx = createUnsignedTx({
      encodedTx: {
        from: '0xuser',
        to: '0xrouter',
        value: '0',
        data: '0xswap',
      },
      nonce: 2,
      swapInfo: {
        protocol: EProtocolOfExchange.SWAP,
        sender: {
          amount: '10',
          token: fromToken,
          accountInfo: { networkId },
        },
        receiver: {
          amount: '0.003',
          token: toToken,
          accountInfo: { networkId },
        },
        accountAddress: '0xuser',
        receivingAddress: '0xuser',
        swapBuildResData: {
          result: {
            info: { provider: 'Uniswap', providerName: 'Uniswap' },
            fromTokenInfo: fromToken,
            toTokenInfo: toToken,
            gasLimit: 145_000,
          },
        },
      },
    });
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(swapUnsignedTx);
    mockGetVaultSettings.mockResolvedValue(evmSettings);
    mockBatchEstimateFee.mockRejectedValue(new Error('batch unavailable'));
    mockBuildEstimateFeeParams.mockImplementation(
      async ({
        encodedTx,
        gasLimit,
      }: Pick<IEstimateGasParams, 'encodedTx' | 'gasLimit'>) => ({
        encodedTx,
        gasLimit,
      }),
    );
    mockEstimateFee.mockImplementation(
      async ({ gasLimit }: Pick<IEstimateGasParams, 'gasLimit'>) => {
        const fee = createEstimateFeeResult();
        return {
          ...fee,
          gas: fee.gas.map((tier) => ({
            ...tier,
            ...(gasLimit ? { gasLimit, gasLimitForDisplay: gasLimit } : {}),
          })),
        };
      },
    );

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId,
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId,
        encodedTx: swapUnsignedTx.encodedTx,
        swapInfo: swapUnsignedTx.swapInfo,
        isInternalSwap: true,
      },
      approveUnsignedTxArr: [approveUnsignedTx],
    });

    expect(mockBatchEstimateFee).not.toHaveBeenCalled();
    expect(mockEstimateFee).toHaveBeenCalledTimes(2);
    expect(mockEstimateFee).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        networkId,
        encodedTx: approveUnsignedTx.encodedTx,
        gasLimit: undefined,
      }),
    );
    expect(mockEstimateFee).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        networkId,
        encodedTx: swapUnsignedTx.encodedTx,
        gasLimit: '145000',
        gasAccountEnabled: false,
      }),
    );
    expect(result.gasInfos).toHaveLength(2);
    expect(result.gasInfos[1].gasInfo.gas).toEqual({
      gasPrice: '2',
      gasLimit: '145000',
      gasLimitForDisplay: '145000',
    });
    expect(result.gasFeeFiatValue).toBeDefined();
  });

  it('falls back to sequential estimation when batch tx fee results are shorter than expected for direct send', async () => {
    const approveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xapprove',
      } as never,
      nonce: 1,
    });
    const swapUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xswap',
      } as never,
      nonce: 2,
    });

    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(swapUnsignedTx);
    mockGetVaultSettings.mockResolvedValue({
      supportBatchEstimateFee: {
        'evm--1': true,
      },
    });
    mockBatchEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      txFees: [createEstimateFeeResult()],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xswap',
        } as never,
        isInternalSwap: true,
      },
      approveUnsignedTxArr: [approveUnsignedTx],
    });

    expect(result.gasInfos).toHaveLength(2);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(result.gasFeeFiatValue).toBeDefined();
  });

  it('builds gas infos from the selected fee level', async () => {
    const preparedUnsignedTx = createUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(preparedUnsignedTx);

    const lowFeeResult = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.LOW,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });
    const highFeeResult = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(lowFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('1');
    expect(highFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('3');
    expect(lowFeeResult.gasFeeFiatValue).not.toBe(
      highFeeResult.gasFeeFiatValue,
    );
    expect(lowFeeResult.preparedUnsignedTx).toBe(preparedUnsignedTx);
    expect(highFeeResult.preparedUnsignedTx).toBe(preparedUnsignedTx);
  });

  it('reuses a prepared unsigned transaction for fee estimation', async () => {
    const preparedUnsignedTx = createUnsignedTx();

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        isInternalSwap: true,
      },
      preparedUnsignedTx,
    });

    expect(mockPrepareSendConfirmUnsignedTx).not.toHaveBeenCalled();
    expect(result.preparedUnsignedTx).toBe(preparedUnsignedTx);
  });

  it('converts a custom EVM legacy priority fee from Gwei to fee unit', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      customPriorityFee: {
        customValue: '7',
      },
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.gas?.gasPrice).toBe('0.000000007');
  });

  it('converts a custom EVM EIP-1559 priority fee from Gwei to fee unit', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      gasEIP1559: [
        {
          baseFeePerGas: '0.00000001',
          maxPriorityFeePerGas: '0.000000001',
          maxFeePerGas: '0.000000011',
          gasLimit: '21000',
        },
      ],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      customPriorityFee: {
        customValue: '5',
      },
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.gasEIP1559).toEqual(
      expect.objectContaining({
        maxPriorityFeePerGas: '0.000000005',
        maxFeePerGas: '0.000000025',
      }),
    );
  });

  it('keeps a custom EVM priority fee in Gwei when the fee unit is already Gwei', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      common: {
        ...createEstimateFeeResult().common,
        feeDecimals: 9,
        feeSymbol: 'Gwei',
      },
      gas: [
        {
          gasPrice: '1',
          gasLimit: '21000',
        },
      ],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      customPriorityFee: {
        customValue: '7',
      },
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.gas?.gasPrice).toBe('7');
  });

  it('converts a custom Solana total priority fee into compute unit price', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockBuildEstimateFeeParams.mockImplementation(async ({ encodedTx }) => ({
      encodedTx,
      estimateFeeParams: {
        estimateFeeParamsSol: {
          baseFee: '5000',
          computeUnitLimit: '200000',
          computeUnitPriceDecimals: 6,
        },
      },
    }));
    mockEstimateFee.mockResolvedValue({
      common: {
        feeDecimals: 9,
        feeSymbol: 'SOL',
        nativeDecimals: 9,
        nativeSymbol: 'SOL',
        nativeTokenPrice: 100,
      },
      feeSol: [
        {
          computeUnitPrice: '1000',
        },
      ],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: 'sol-user',
      accountId: 'account-sol',
      networkId: 'sol--101',
      customPriorityFee: {
        customValue: '0.001',
      },
      buildUnsignedParams: {
        accountId: 'account-sol',
        networkId: 'sol--101',
        encodedTx: {
          data: 'sol-tx',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.feeSol?.computeUnitPrice).toBe('5000000');
    expect(result.gasInfos[0].estimateFeeParams?.estimateFeeParamsSol).toEqual({
      baseFee: '5000',
      computeUnitLimit: '200000',
      computeUnitPriceDecimals: 6,
    });
    // Regression guard: without estimateFeeParams plumbed through, the SOL
    // branch returns only baseFee (~$0.0005) instead of ~$0.1005.
    expect(result.gasFeeFiatValue).toBeDefined();
    expect(Number(result.gasFeeFiatValue)).toBeCloseTo(0.1005, 4);
  });

  it('ignores gas infos without common data when aggregating fiat values', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      gas: [
        {
          gasPrice: '1',
          gasLimit: '21000',
        },
      ],
    } as never);

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos).toHaveLength(1);
    expect(result.gasInfos[0].gasInfo.common).toBeUndefined();
    expect(result.gasFeeFiatValue).toBeUndefined();
  });

  it('estimates approve-only gas infos from the selected fee level', async () => {
    const resetApproveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xreset',
      } as never,
      nonce: 1,
    });
    const approveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xapprove',
      } as never,
      nonce: 2,
    });

    const lowFeeResult = await estimateMarketApproveGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.LOW,
      approveUnsignedTxArr: [resetApproveUnsignedTx, approveUnsignedTx],
    });
    const highFeeResult = await estimateMarketApproveGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      approveUnsignedTxArr: [resetApproveUnsignedTx, approveUnsignedTx],
    });

    expect(lowFeeResult.gasInfos).toHaveLength(2);
    expect(highFeeResult.gasInfos).toHaveLength(2);
    expect(lowFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('1');
    expect(highFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('3');
    expect(mockEstimateFee).toHaveBeenCalledTimes(4);
  });

  it('falls back to sequential estimation when batch tx fee results are shorter than expected for approve-only gas infos', async () => {
    const approveUnsignedTxA = createUnsignedTx({
      encodedTx: {
        data: '0xapprove-a',
      } as never,
      nonce: 1,
    });
    const approveUnsignedTxB = createUnsignedTx({
      encodedTx: {
        data: '0xapprove-b',
      } as never,
      nonce: 2,
    });

    mockGetVaultSettings.mockResolvedValue({
      supportBatchEstimateFee: {
        'evm--1': true,
      },
    });
    mockBatchEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      txFees: [createEstimateFeeResult()],
    });

    const result = await estimateMarketApproveGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      approveUnsignedTxArr: [approveUnsignedTxA, approveUnsignedTxB],
    });

    expect(result.gasInfos).toHaveLength(2);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(2);
  });

  it('preserves the selected fee level when send-time gas info must be rebuilt', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());

    await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
      gasInfos: [
        {
          encodeTx: {
            data: '0xother',
          } as never,
          gasInfo: {
            common: createEstimateFeeResult().common,
            gas: {
              gasPrice: '1',
              gasLimit: '21000',
            },
          } as never,
        },
      ],
    });

    expect(mockUpdateUnsignedTx).toHaveBeenCalledWith(
      expect.objectContaining({
        feeInfo: expect.objectContaining({
          gas: expect.objectContaining({
            gasPrice: '3',
          }),
        }),
      }),
    );
  });

  it('validates rebuilt send-time gas infos before signing', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    const validateFinalGasInfos = jest
      .fn()
      .mockRejectedValue(new Error('insufficient final gas balance'));

    await expect(
      sendMarketDirectUnsignedTxs({
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        buildUnsignedParams: {
          accountId: 'account-1',
          networkId: 'evm--1',
          encodedTx: {
            data: '0xencoded',
          } as never,
          isInternalSwap: true,
        },
        gasInfos: [
          {
            encodeTx: {
              data: '0xstale',
            } as never,
            gasInfo: {
              common: createEstimateFeeResult().common,
              gas: {
                gasPrice: '1',
                gasLimit: '21000',
              },
            },
          },
        ],
        validateFinalGasInfos,
      }),
    ).rejects.toThrow('insufficient final gas balance');

    expect(validateFinalGasInfos).toHaveBeenCalledWith([
      expect.objectContaining({
        gasInfo: expect.objectContaining({
          gas: expect.objectContaining({
            gasPrice: '2',
          }),
        }),
      }),
    ]);
    expect(mockUpdateUnsignedTx).not.toHaveBeenCalled();
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure', 'cancel', 'validation failure'])(
    'reports only the final sponsored fallback outcome: %s',
    async (outcome) => {
      const unsignedTx = createSponsoredUnsignedTx();
      mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
      mockEstimateFee.mockResolvedValue(
        createSponsoredEstimateFeeResult('gas-quote'),
      );
      const terminalError = new Error(`fallback ${outcome}`);
      const order: string[] = [];
      const validateFinalGasInfos = jest.fn(async () => {
        order.push('validate');
        if (outcome === 'validation failure' && order.length > 1)
          throw terminalError;
      });
      mockSignAndSendTransaction
        .mockImplementationOnce(async () => {
          order.push('sponsor');
          const sponsorError = Object.assign(new Error('Sponsor failed'), {
            code: 40_213,
          });
          throw sponsorError;
        })
        .mockImplementationOnce(async () => {
          order.push('user');
          if (outcome !== 'success') throw terminalError;
          return { txid: '0xfallback', rawTx: '0xraw' };
        });
      const sending = sendMarketDirectUnsignedTxs({
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        buildUnsignedParams: {
          accountId: 'account-1',
          networkId: 'evm--1',
          encodedTx: unsignedTx.encodedTx,
          swapInfo: unsignedTx.swapInfo,
          isInternalSwap: true,
        },
        validateFinalGasInfos,
        shouldReportSendError: (error) =>
          !(outcome === 'cancel' && error === terminalError),
      });
      if (outcome === 'success') expect(await sending).toHaveLength(1);
      else await expect(sending).rejects.toBe(terminalError);
      expect(order).toEqual(
        outcome === 'validation failure'
          ? ['validate', 'sponsor', 'validate']
          : ['validate', 'sponsor', 'validate', 'user'],
      );
      expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(
        outcome === 'validation failure' ? 1 : 2,
      );
      expect(
        mockSignAndSendTransaction.mock.calls[0][0].gasAccountUiState,
      ).toBeDefined();
      if (outcome !== 'validation failure')
        expect(
          mockSignAndSendTransaction.mock.calls[1][0].gasAccountUiState,
        ).toBeUndefined();
      expect(mockSwapSendTx).toHaveBeenCalledTimes(
        outcome === 'cancel' ? 0 : 1,
      );
      if (outcome !== 'cancel')
        expect(mockSwapSendTx).toHaveBeenCalledWith(
          expect.objectContaining({
            status: outcome === 'success' ? 'success' : 'fail',
            reviewSessionId: 'market-session',
            quoteId: 'quote-id',
            orderId: 'order-id',
          }),
        );
      expect(mockSaveSendConfirmHistoryTxs).toHaveBeenCalledTimes(
        outcome === 'success' ? 1 : 0,
      );
    },
  );

  it('revalidates user-paid gas before retrying a failed sponsor send', async () => {
    const sponsoredUnsignedTx = createSponsoredUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(sponsoredUnsignedTx);
    mockEstimateFee.mockResolvedValue({
      ...createEstimateFeeResult(),
      payer: 'gasAccount',
      gasAccountEligible: true,
      gasAccountQuote: {
        quoteId: 'gas-account-quote',
      },
    });
    mockSignAndSendTransaction.mockRejectedValueOnce({ code: 40_213 });
    const validateFinalGasInfos = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('insufficient user-paid gas balance'));

    await expect(
      sendMarketDirectUnsignedTxs({
        accountAddress: '0xuser',
        accountId: 'account-1',
        networkId: 'evm--1',
        buildUnsignedParams: {
          accountId: 'account-1',
          networkId: 'evm--1',
          encodedTx: sponsoredUnsignedTx.encodedTx,
          isInternalSwap: true,
        },
        validateFinalGasInfos,
      }),
    ).rejects.toThrow('insufficient user-paid gas balance');

    expect(validateFinalGasInfos).toHaveBeenCalledTimes(2);
    expect(validateFinalGasInfos).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        gasInfo: expect.objectContaining({
          payer: 'gasAccount',
          gasAccountEligible: true,
        }),
      }),
    ]);
    expect(validateFinalGasInfos).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        gasInfo: expect.objectContaining({
          payer: 'user',
          gasAccountEligible: false,
        }),
      }),
    ]);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps Tron high fee selection aligned with the legacy confirm flow', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      feeTron: [
        {
          requiredEnergy: '10',
          requiredBandwidth: '100',
        },
        {
          requiredEnergy: '20',
          requiredBandwidth: '200',
        },
        {
          requiredEnergy: '30',
          requiredBandwidth: '300',
        },
      ],
    });

    const highFeeResult = await estimateMarketDirectGasInfos({
      accountAddress: 'TUser',
      accountId: 'account-tron',
      networkId: 'tron--0x2b6653dc',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      buildUnsignedParams: {
        accountId: 'account-tron',
        networkId: 'tron--0x2b6653dc',
        encodedTx: {
          raw_data_hex: '0xtron',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(highFeeResult.gasInfos[0].gasInfo.feeTron?.requiredEnergy).toBe(
      '10',
    );
    expect(highFeeResult.gasInfos[0].gasInfo.feeTron?.requiredBandwidth).toBe(
      '100',
    );
  });

  it('runs legacy send hooks around direct send execution', async () => {
    const preparedUnsignedTx = createUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(preparedUnsignedTx);
    mockGetVaultSettings.mockResolvedValue({
      afterSendTxActionEnabled: true,
    });

    await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(mockPreActionsBeforeSending).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
      unsignedTxs: [preparedUnsignedTx],
      tronResourceRentalInfo: undefined,
    });
    expect(mockAfterSendTxAction).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: 'account-1',
      result: [
        expect.objectContaining({
          signedTx: expect.objectContaining({
            txid: '0xtx',
          }),
        }),
      ],
    });
  });
});
