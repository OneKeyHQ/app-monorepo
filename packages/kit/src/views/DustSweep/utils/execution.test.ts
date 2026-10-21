import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketGasInfoEntry,
  estimateMarketApproveGasInfos,
  estimateMarketDirectGasInfos,
  prepareMarketDirectUnsignedTx,
  sendMarketDirectUnsignedTxs,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import { buildSwapReviewState } from '@onekeyhq/kit/src/views/Swap/utils/buildSwapReviewState';
import type { getSwapRequiredNativeBalanceAmount } from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { withBroadcastTxContext } from '@onekeyhq/shared/src/errors/utils/broadcastTxErrorUtils';
import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapStepType,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapApproveAllowanceResponse,
} from '@onekeyhq/shared/types/swap/types';

const mockFetchQuote = jest.fn();
const mockAllowance: jest.MockedFunction<
  typeof backgroundApiProxy.serviceSwap.fetchApproveAllowanceForDisplay
> = jest.fn();
const mockBuild = jest.fn();
const mockTxState: jest.MockedFunction<
  typeof backgroundApiProxy.serviceSwap.fetchTxState
> = jest.fn();
const mockPayload = jest.fn();
const mockSend: jest.MockedFunction<typeof sendMarketDirectUnsignedTxs> =
  jest.fn();
const mockPrepare: jest.MockedFunction<typeof prepareMarketDirectUnsignedTx> =
  jest.fn();
const mockEstimate: jest.MockedFunction<typeof estimateMarketDirectGasInfos> =
  jest.fn();
const mockEstimateApprovals: jest.MockedFunction<
  typeof estimateMarketApproveGasInfos
> = jest.fn();
const mockHistory = jest.fn();
const mockBlockNotification = jest.fn();
const mockBalance = jest.fn();
const mockGasRequirement: jest.MockedFunction<
  typeof getSwapRequiredNativeBalanceAmount
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: { blockNotificationForTxId: mockBlockNotification },
    serviceSwap: {
      fetchApproveAllowanceForDisplay: mockAllowance,
      fetchBuildTx: mockBuild,
      fetchTxState: mockTxState,
    },
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils',
  () => ({ buildMarketExecutionPayload: mockPayload }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx',
  () => ({
    sendMarketDirectUnsignedTxs: mockSend,
    MarketDirectFeeOverflowError: class extends Error {},
    prepareMarketDirectUnsignedTx: mockPrepare,
    estimateMarketDirectGasInfos: mockEstimate,
    estimateMarketApproveGasInfos: mockEstimateApprovals,
  }),
);
jest.mock('@onekeyhq/kit/src/views/Swap/hooks/swapBroadcastSuccess', () => ({
  completeBroadcastedSwapSuccess: mockHistory,
}));
jest.mock('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils', () => ({
  checkSwapLatestBalanceSufficient: mockBalance,
  getSwapRequiredNativeBalanceAmount: mockGasRequirement,
}));
jest.mock('./quote', () => ({
  ...jest.requireActual<typeof import('./quote')>('./quote'),
  fetchDustSweepQuote: mockFetchQuote,
}));

const {
  executeDustSweepItem,
  DustSweepUnknownSubmission,
  DustSweepPaused,
  DustSweepRetryableError,
  DustSweepUserCanceled,
} = require('./execution') as typeof import('./execution');

const { DustSweepSkip } = require('./quote') as typeof import('./quote');

const { MarketDirectFeeOverflowError } =
  require('@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx') as typeof import('@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx');

type ISendParams = Parameters<typeof sendMarketDirectUnsignedTxs>[0];
const token: IDustSweepToken = {
  key: 'dust',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'DUST',
  decimals: 18,
  amount: '10',
  valueUsd: '10',
  price: '1',
  suspicious: false,
};
const snapshot: IDustSweepSnapshot = {
  id: 'session',
  accountId: 'account',
  address: '0xuser',
  networkId: token.networkId,
  tokens: [token],
  slippage: 5,
  nativeToken: {
    networkId: token.networkId,
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
    price: '1000',
  },
};
function createQuote(spender = '0xspender'): IFetchQuoteResult {
  return {
    info: { provider: 'SwapOKX', providerName: 'OKX' },
    fromTokenInfo: token,
    toTokenInfo: snapshot.nativeToken,
    fromAmount: token.amount,
    toAmount: '0.01',
    allowanceResult: { allowanceTarget: spender, amount: token.amount },
  };
}
function createAllowance(
  overrides: Partial<ISwapApproveAllowanceResponse> = {},
): ISwapApproveAllowanceResponse {
  return {
    isApproved: true,
    allowanceTarget: '0xspender',
    shouldApproveAmount: token.amount,
    approveAmounted: token.amount,
    ...overrides,
  };
}
function createOptions() {
  return {
    snapshot,
    token,
    signal: new AbortController().signal,
    onSigning: jest.fn(),
    onPrepared: jest.fn(),
    onApprovalBroadcast: jest.fn(),
    onBroadcast: jest.fn(),
    onSubmissionError: jest.fn(),
    generateSwapHistoryItem: jest.fn(),
  };
}
function createGasEntry(gasLimit = '100000'): IMarketGasInfoEntry {
  return {
    encodeTx: {},
    gasInfo: {
      common: {
        feeDecimals: 9,
        feeSymbol: 'Gwei',
        nativeDecimals: 18,
        nativeSymbol: 'ETH',
      },
      gas: { gasLimit, gasPrice: '10' },
    },
  };
}
function createTronGasEntry(
  originalFee: number,
  feeDecimals = 6,
): IMarketGasInfoEntry {
  return {
    encodeTx: {},
    gasInfo: {
      common: {
        feeDecimals,
        feeSymbol: 'TRX',
        nativeDecimals: 6,
        nativeSymbol: 'TRX',
        baseFee: '0',
      },
      feeTron: {
        originalFee,
        requiredEnergy: 65_000,
        requiredBandwidth: 300,
        accountInfo: {
          energyTotal: 70_000,
          energyUsed: 0,
          freeEnergyTotal: 0,
          freeEnergyUsed: 0,
        },
        balances: {},
        tokenPrices: {},
        info: {
          orderPrice: 0,
          prices: {},
          ratio: '0',
          pledgeMinute: 0,
          payCoinAmt: 0,
          payCoinCode: '',
          extraTrxNum: 0,
          purchaseTRXFee: 0,
          exchangeFee: 0,
        },
      },
    },
  };
}
async function sendTransaction(params: ISendParams) {
  await params.validateFinalGasInfos?.([]);
  await params.onBeforeSignAndSend?.();
  const approval = params.buildUnsignedParams.approveInfo;
  params.onBroadcast?.({
    txid: approval ? `approval-${mockSend.mock.calls.length - 1}` : 'swap',
    rawTx: '',
    encodedTx: null,
  });
  return [];
}

describe('Dust Sweep serial execution boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchQuote.mockReset().mockResolvedValue(createQuote());
    mockAllowance.mockReset().mockResolvedValue(createAllowance());
    mockBuild.mockReset().mockResolvedValue({ result: createQuote(), ctx: {} });
    mockPayload.mockReset().mockResolvedValue({
      encodedTx: {},
      swapInfo: {},
      skipSendTransAction: false,
    });
    mockSend.mockReset().mockImplementation(sendTransaction);
    mockPrepare.mockReset().mockResolvedValue({ encodedTx: {}, nonce: 100 });
    mockEstimate.mockReset().mockImplementation(async (params) => ({
      gasInfos: [
        ...(params.approveUnsignedTxArr ?? []).map(() => createGasEntry()),
        createGasEntry('500000'),
      ],
      preparedUnsignedTx: { encodedTx: {}, nonce: 101 },
    }));
    mockEstimateApprovals.mockReset().mockImplementation(async (params) => ({
      gasInfos: params.approveUnsignedTxArr.map(() => createGasEntry()),
    }));
    mockHistory.mockReset().mockResolvedValue(undefined);
    mockBlockNotification.mockReset().mockResolvedValue(undefined);
    mockBalance
      .mockReset()
      .mockResolvedValue({ isSufficient: true, balance: '100' });
    mockGasRequirement.mockReset().mockReturnValue({
      token: snapshot.nativeToken,
      amount: '0.1',
      reserveAmount: '0.1',
      includesFromAmount: false,
    });
    mockTxState.mockReset().mockResolvedValue({
      state: ESwapTxHistoryStatus.SUCCESS,
      dealReceiveAmount: '0.009',
    });
  });

  it('does not sign an old preparation after the queue has stopped', async () => {
    let allowed = true;
    mockBuild.mockImplementation(async () => {
      allowed = false;
      return { result: createQuote(), ctx: {} };
    });
    const options = { ...createOptions(), shouldContinue: () => allowed };
    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepPaused,
    );
    expect(mockSend).not.toHaveBeenCalled();
    expect(options.onSigning).not.toHaveBeenCalled();
  });

  it('preserves a broadcast approval but stops before signing the swap', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    let allowed = true;
    const options = {
      ...createOptions(),
      shouldContinue: () => allowed,
      onApprovalBroadcast: jest.fn(() => {
        allowed = false;
      }),
    };
    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepPaused,
    );
    expect(options.onApprovalBroadcast).toHaveBeenCalledWith(['approval-0']);
    expect(options.onSigning).toHaveBeenCalledTimes(1);
    expect(options.onPrepared).toHaveBeenCalledTimes(1);
    expect(options.onBroadcast).not.toHaveBeenCalled();
  });

  it('keeps tracking a broadcast swap after stopping the queue', async () => {
    let allowed = true;
    const options = {
      ...createOptions(),
      shouldContinue: () => allowed,
      onBroadcast: jest.fn(() => {
        allowed = false;
      }),
    };
    await expect(executeDustSweepItem(options)).resolves.toMatchObject({
      status: 'success',
    });
    expect(mockTxState).toHaveBeenCalledWith(
      expect.objectContaining({ txId: 'swap' }),
    );
    expect(mockHistory).toHaveBeenCalledTimes(1);
    expect(options.onSigning).toHaveBeenCalledTimes(1);
  });

  it('blocks a stopped retry after the SDK was already entered without a hash', async () => {
    let allowed = true;
    mockSend.mockImplementation(async (params) => {
      await params.onBeforeSignAndSend?.();
      allowed = false;
      // A sponsored-send fallback may invoke the submission guard again.
      await params.onBeforeSignAndSend?.();
      return [];
    });
    const options = { ...createOptions(), shouldContinue: () => allowed };
    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepUnknownSubmission,
    );
    expect(options.onSigning).toHaveBeenCalledTimes(1);
    expect(options.onPrepared).not.toHaveBeenCalled();
    expect(options.onBroadcast).not.toHaveBeenCalled();
  });

  it('leaves a hung preparation and ignores its late build response', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    let resolveBuild: (value: unknown) => void = () => undefined;
    mockBuild.mockReturnValue(
      new Promise((resolve) => {
        resolveBuild = resolve;
      }),
    );
    const options = { ...createOptions(), signal: controller.signal };
    const completion = executeDustSweepItem(options).catch(
      (error: unknown) => error,
    );
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(mockBuild).toHaveBeenCalledTimes(1);
      controller.abort();
      expect(await completion).toBeInstanceOf(Error);
      resolveBuild({ result: createQuote() });
      await jest.advanceTimersByTimeAsync(0);
      expect(mockPayload).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    } finally {
      controller.abort();
      jest.useRealTimers();
    }
  });

  it('requotes after approval confirmation and sends only the fresh build with a new gas estimate', async () => {
    mockFetchQuote
      .mockResolvedValueOnce({
        ...createQuote('0xfirst'),
        quoteResultCtx: { quote: 'before' },
      })
      .mockResolvedValueOnce({
        ...createQuote('0xfirst'),
        quoteResultCtx: { quote: 'after' },
      });
    mockAllowance.mockResolvedValueOnce(
      createAllowance({
        isApproved: false,
        allowanceTarget: '0xfirst',
        approveAmounted: '0',
      }),
    );
    mockBuild
      .mockResolvedValueOnce({
        result: createQuote('0xfirst'),
        ctx: { order: 'before' },
      })
      .mockResolvedValueOnce({
        result: createQuote('0xfirst'),
        ctx: { order: 'after' },
      });
    mockPayload
      .mockResolvedValueOnce({
        encodedTx: { data: 'old' },
        swapInfo: {},
        orderId: 'before',
      })
      .mockResolvedValueOnce({
        encodedTx: { data: 'fresh' },
        swapInfo: {},
        orderId: 'after',
      });
    mockTxState.mockImplementation(async ({ txId }) => {
      if (txId === 'approval-0') {
        expect(mockFetchQuote).toHaveBeenCalledTimes(1);
        expect(mockBuild).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockBlockNotification).not.toHaveBeenCalled();
      }
      return {
        state: ESwapTxHistoryStatus.SUCCESS,
        dealReceiveAmount: '0.009',
      };
    });
    const options = createOptions();
    await executeDustSweepItem(options);
    expect(options.onSigning).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockFetchQuote).toHaveBeenCalledTimes(2);
    expect(mockBuild).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ quoteResultCtx: { quote: 'before' } }),
    );
    expect(mockBuild).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ quoteResultCtx: { quote: 'after' } }),
    );
    expect(mockSend.mock.calls[0][0].buildUnsignedParams.approveInfo).toEqual(
      expect.objectContaining({ spender: '0xfirst' }),
    );
    expect(mockAllowance).toHaveBeenCalledWith(
      expect.objectContaining({ spenderAddress: '0xfirst' }),
    );
    expect(mockSend.mock.calls[1][0]).toMatchObject({
      buildUnsignedParams: { encodedTx: { data: 'fresh' } },
    });
    expect(mockSend.mock.calls[1][0].gasInfos).toBeUndefined();
    expect(mockSend.mock.calls[1][0].approveUnsignedTxArr).toBeUndefined();
    expect(mockBlockNotification).toHaveBeenCalledTimes(1);
    expect(mockBlockNotification).toHaveBeenCalledWith({
      networkId: snapshot.networkId,
      tx: 'swap',
    });
    expect(mockTxState).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderId: 'after', ctx: { order: 'after' } }),
    );
  });

  it('pauses instead of sending if the rebuilt route requires another approval', async () => {
    mockAllowance.mockResolvedValue(createAllowance({ isApproved: false }));
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepRetryableError,
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(options.onBroadcast).not.toHaveBeenCalled();
  });

  it('keeps earlier approval hashes when a resumed item grants its allowance', async () => {
    mockAllowance.mockResolvedValueOnce(createAllowance({ isApproved: false }));
    const options = {
      ...createOptions(),
      pendingApprovalTxIds: ['reset-known'],
    };
    await executeDustSweepItem(options);
    expect(options.onApprovalBroadcast).toHaveBeenLastCalledWith([
      'reset-known',
      'approval-0',
    ]);
  });

  it.each(['approval', 'swap'] as const)(
    'can leave a hung %s status request without a resend',
    async (stage) => {
      jest.useFakeTimers();
      const controller = new AbortController();
      if (stage === 'approval')
        mockAllowance.mockResolvedValueOnce(
          createAllowance({ isApproved: false }),
        );
      mockTxState.mockImplementation(() => new Promise(() => undefined));
      const options = { ...createOptions(), signal: controller.signal };
      const completion = executeDustSweepItem(options).catch(
        (error: unknown) => error,
      );
      try {
        await jest.advanceTimersByTimeAsync(0);
        expect(mockTxState).toHaveBeenCalledTimes(1);
        controller.abort();
        expect(await completion).toBeInstanceOf(Error);
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(options.onSigning).toHaveBeenCalledTimes(1);
      } finally {
        controller.abort();
        jest.useRealTimers();
      }
    },
  );

  it('waits for a broadcast approval before retrying a canceled swap signature', async () => {
    mockAllowance
      .mockResolvedValueOnce(
        createAllowance({
          isApproved: false,
          allowanceTarget: '0xfirst',
          approveAmounted: '0',
        }),
      )
      .mockResolvedValueOnce(createAllowance());
    mockSend.mockImplementationOnce(async (params) => {
      await params.validateFinalGasInfos?.([]);
      await params.onBeforeSignAndSend?.();
      params.onBroadcast?.({
        txid: 'approval-0',
        rawTx: '',
        encodedTx: null,
      });
      throw Object.assign(new Error('user canceled'), {
        className: EOneKeyErrorClassNames.PasswordPromptDialogCancel,
      });
    });
    const options = createOptions();

    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepUserCanceled,
    );
    expect(options.onApprovalBroadcast).toHaveBeenCalledWith(['approval-0']);

    mockSend.mockImplementationOnce(sendTransaction);
    await expect(
      executeDustSweepItem({
        ...options,
        pendingApprovalTxIds: ['approval-0'],
      }),
    ).resolves.toMatchObject({ status: 'success' });
    expect(mockTxState).toHaveBeenCalledWith({
      txId: 'approval-0',
      networkId: snapshot.networkId,
    });
    expect(mockSend.mock.calls[1][0].approveUnsignedTxArr).toBeUndefined();
  });

  it('uses the build response spender when the provider changes it', async () => {
    mockBuild.mockResolvedValue({ result: createQuote('0xchanged') });
    mockAllowance.mockResolvedValueOnce(
      createAllowance({
        isApproved: false,
        allowanceTarget: '0xchanged',
        approveAmounted: '0',
      }),
    );
    await expect(executeDustSweepItem(createOptions())).resolves.toMatchObject({
      status: 'success',
    });
    expect(
      mockSend.mock.calls[0][0].buildUnsignedParams.approveInfo,
    ).toBeDefined();
    expect(mockSend.mock.calls[1][0].approveUnsignedTxArr).toBeUndefined();
    expect(mockSend.mock.calls[0][0].buildUnsignedParams.approveInfo).toEqual(
      expect.objectContaining({ spender: '0xchanged' }),
    );
  });

  it('polls with the provider and context of the actual OKX build', async () => {
    mockBuild.mockResolvedValue({
      result: {
        ...createQuote(),
        info: { provider: 'SwapOKX', providerName: 'OKX Dex' },
      },
      ctx: { build: 'actual' },
    });
    await expect(executeDustSweepItem(createOptions())).resolves.toMatchObject({
      status: 'success',
    });
    expect(mockTxState).toHaveBeenCalledWith(
      expect.objectContaining({
        txId: 'swap',
        provider: 'SwapOKX',
        ctx: { build: 'actual' },
      }),
    );
  });

  it('retains Sweep attribution when building each quoted token', async () => {
    mockFetchQuote.mockResolvedValue({
      ...createQuote(),
      quoteResultCtx: { routeId: 'dust-route' },
    });
    await executeDustSweepItem(createOptions());
    expect(mockBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'Sweep',
        tradeSource: 'swapBridge',
        provider: 'SwapOKX',
        quoteResultCtx: { routeId: 'dust-route' },
        fromToken: token,
        toToken: snapshot.nativeToken,
        fromTokenAmount: token.amount,
        userAddress: snapshot.address,
        receivingAddress: snapshot.address,
      }),
    );
  });

  it('never prepares or signs a build that changes the provider from OKX', async () => {
    mockBuild.mockResolvedValue({
      result: {
        ...createQuote(),
        info: { provider: 'SwapLiquidMesh', providerName: 'LiquidMesh' },
      },
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'noQuote',
    });
    expect(mockPayload).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('waits for the initial approval before entering swap signing', async () => {
    jest.useFakeTimers();
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockTxState
      .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.PENDING })
      .mockResolvedValue({
        state: ESwapTxHistoryStatus.SUCCESS,
        dealReceiveAmount: '0.009',
      });
    const options = createOptions();
    const operation = executeDustSweepItem(options);
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(options.onApprovalBroadcast).toHaveBeenCalledWith(['approval-0']);
      expect(options.onSigning).toHaveBeenCalledTimes(1);
      expect(options.onBroadcast).not.toHaveBeenCalled();
      expect(mockTxState).toHaveBeenCalledWith({
        txId: 'approval-0',
        networkId: snapshot.networkId,
      });
      await jest.advanceTimersByTimeAsync(3000);
      await expect(operation).resolves.toMatchObject({ status: 'success' });
      expect(options.onSigning).toHaveBeenCalledTimes(2);
      expect(options.onBroadcast).toHaveBeenCalledWith('swap');
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ESwapTxHistoryStatus.FAILED,
    ESwapTxHistoryStatus.CANCELED,
    ESwapTxHistoryStatus.EXPIRED,
    ESwapTxHistoryStatus.REFUNDED,
  ])(
    'never signs the swap after an initial approval becomes %s',
    async (state) => {
      mockAllowance.mockResolvedValueOnce(
        createAllowance({ isApproved: false, approveAmounted: '0' }),
      );
      mockTxState.mockResolvedValueOnce({ state });
      const options = createOptions();
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'txFailed',
      });
      expect(options.onApprovalBroadcast).toHaveBeenCalledWith(['approval-0']);
      expect(options.onSigning).toHaveBeenCalledTimes(1);
      expect(options.onBroadcast).not.toHaveBeenCalled();
      expect(mockHistory).not.toHaveBeenCalled();
    },
  );

  it('stops an aborted initial approval wait without starting a swap or resending', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockTxState.mockResolvedValue({ state: ESwapTxHistoryStatus.PENDING });
    const options = { ...createOptions(), signal: controller.signal };
    const operation = executeDustSweepItem(options);
    const completion = operation.catch((error: unknown) => error);
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(options.onApprovalBroadcast).toHaveBeenCalledWith(['approval-0']);
      controller.abort();
      expect(await completion).not.toBeInstanceOf(DustSweepUnknownSubmission);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(options.onSigning).toHaveBeenCalledTimes(1);
      expect(options.onBroadcast).not.toHaveBeenCalled();
    } finally {
      controller.abort();
      await completion;
      jest.useRealTimers();
    }
  });

  it.each([false, true])(
    'skips excessive fees without signing, including after approval: %s',
    async (afterApproval) => {
      if (afterApproval) {
        mockAllowance.mockResolvedValueOnce(
          createAllowance({ isApproved: false, approveAmounted: '0' }),
        );
        mockSend.mockImplementationOnce(async (params) => {
          expect(params.rejectFeeInfoOverflow).toBe(true);
          await params.onBeforeSignAndSend?.();
          params.onBroadcast?.({
            txid: 'approval-known',
            rawTx: '',
            encodedTx: null,
          });
          return [];
        });
      }
      mockSend.mockImplementationOnce(async (params) => {
        expect(params.rejectFeeInfoOverflow).toBe(true);
        throw new MarketDirectFeeOverflowError();
      });
      const options = createOptions();
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'unknown',
      });
      expect(options.onSigning).toHaveBeenCalledTimes(afterApproval ? 1 : 0);
      expect(options.onBroadcast).not.toHaveBeenCalled();
      expect(mockHistory).not.toHaveBeenCalled();
    },
  );

  it('keeps a known approval recoverable if its history write fails before swap signing', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockSend.mockImplementationOnce(async (params) => {
      await params.onBeforeSignAndSend?.();
      params.onBroadcast?.({
        txid: 'approval-known',
        rawTx: '',
        encodedTx: null,
      });
      throw new OneKeyLocalError('Approval history unavailable');
    });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepRetryableError,
    );
    expect(options.onApprovalBroadcast).toHaveBeenCalledWith([
      'approval-known',
    ]);
    expect(options.onPrepared).toHaveBeenCalledTimes(1);
    expect(options.onBroadcast).not.toHaveBeenCalled();
  });

  it('still treats an unconfirmed swap signing attempt after a known approval as unknown', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockSend.mockImplementationOnce(async (params) => {
      await params.onBeforeSignAndSend?.();
      params.onBroadcast?.({
        txid: 'approval-known',
        rawTx: '',
        encodedTx: null,
      });
      return [];
    });
    mockSend.mockImplementationOnce(async (params) => {
      await params.onBeforeSignAndSend?.();
      throw new OneKeyLocalError('Swap transport unavailable');
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toBeInstanceOf(
      DustSweepUnknownSubmission,
    );
  });

  it('obtains fresh quotes only after a pending approval settles', async () => {
    jest.useFakeTimers();
    mockTxState
      .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.PENDING })
      .mockResolvedValue({
        state: ESwapTxHistoryStatus.SUCCESS,
        dealReceiveAmount: '0.009',
      });
    const operation = executeDustSweepItem({
      ...createOptions(),
      pendingApprovalTxIds: ['approval-pending'],
    });
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(mockFetchQuote).not.toHaveBeenCalled();
      expect(mockBuild).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(3000);
      await expect(operation).resolves.toMatchObject({ status: 'success' });
      expect(mockFetchQuote).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not build or sign if a previously broadcast approval failed', async () => {
    mockTxState.mockResolvedValueOnce({ state: ESwapTxHistoryStatus.FAILED });
    await expect(
      executeDustSweepItem({
        ...createOptions(),
        pendingApprovalTxIds: ['approval-failed'],
      }),
    ).rejects.toMatchObject({ reason: 'txFailed' });
    expect(mockFetchQuote).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('accepts the latest explicit approved quote when no approval target is returned', async () => {
    const approvedQuote = {
      ...createQuote(),
      allowanceResult: undefined,
      approvedInfo: { isApproved: true },
    };
    mockFetchQuote.mockResolvedValue(approvedQuote);
    mockBuild.mockResolvedValue({ result: approvedQuote });
    await expect(executeDustSweepItem(createOptions())).resolves.toMatchObject({
      status: 'success',
    });
    expect(mockAllowance).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('reports an on-chain swap failure after the confirmed approval', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockTxState
      .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.SUCCESS })
      .mockResolvedValue({ state: ESwapTxHistoryStatus.FAILED });
    await expect(executeDustSweepItem(createOptions())).resolves.toEqual({
      status: 'failed',
      message: undefined,
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockBuild).toHaveBeenCalledTimes(2);
  });

  it('settles a reset approval before granting the exact new allowance', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({
        isApproved: false,
        approveAmounted: '1',
        shouldResetApprove: true,
      }),
    );
    const options = createOptions();
    await executeDustSweepItem(options);
    expect(options.onSigning).toHaveBeenCalledTimes(3);
    expect(mockTxState.mock.calls.map(([params]) => params.txId)).toEqual([
      'approval-0',
      'approval-1',
      'swap',
    ]);
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(
      mockSend.mock.calls.every(
        ([params]) => !params.approveUnsignedTxArr?.length,
      ),
    ).toBe(true);
    expect(
      mockSend.mock.calls.flatMap(([params]) =>
        params.buildUnsignedParams.approveInfo
          ? [params.buildUnsignedParams.approveInfo.amount]
          : [],
      ),
    ).toEqual(['0', '10']);
  });

  it('never grants allowance or signs a swap after the reset approval fails', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({
        isApproved: false,
        approveAmounted: '1',
        shouldResetApprove: true,
      }),
    );
    mockTxState.mockResolvedValueOnce({ state: ESwapTxHistoryStatus.FAILED });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toMatchObject({
      reason: 'txFailed',
    });
    expect(options.onApprovalBroadcast).toHaveBeenCalledTimes(1);
    expect(options.onApprovalBroadcast).toHaveBeenCalledWith(['approval-0']);
    expect(options.onSigning).toHaveBeenCalledTimes(1);
    expect(options.onBroadcast).not.toHaveBeenCalled();
  });

  it('builds the grant only after reset confirmation without freezing its nonce', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, shouldResetApprove: true }),
    );
    let confirmReset: (value: { state: ESwapTxHistoryStatus }) => void = () =>
      undefined;
    let notifyResetStarted: () => void = () => undefined;
    const resetStarted = new Promise<void>((resolve) => {
      notifyResetStarted = resolve;
    });
    mockTxState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirmReset = resolve;
          notifyResetStarted();
        }),
    );
    const completion = executeDustSweepItem(createOptions());
    await resetStarted;
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].buildUnsignedParams).toEqual({
      accountId: snapshot.accountId,
      networkId: snapshot.networkId,
      approveInfo: expect.objectContaining({ amount: '0' }),
    });
    confirmReset({ state: ESwapTxHistoryStatus.SUCCESS });
    await completion;
    // The shared sender builds from current account state; neither a cached
    // unsigned transaction nor a pre-reset nonce may reach the grant.
    expect(mockSend.mock.calls[1][0].buildUnsignedParams).toEqual({
      accountId: snapshot.accountId,
      networkId: snapshot.networkId,
      approveInfo: expect.objectContaining({ amount: '10' }),
    });
  });

  it.each([
    ['unavailable', 6],
    ['insufficient', 6],
    ['insufficient', 0],
    ['missing-original', 6],
    ['success', 6],
  ] as const)(
    'estimates Tron swap gas separately (%s, feeDecimals=%s)',
    async (scenario, feeDecimals) => {
      const tronToken = { ...token, networkId: 'tron--0x2b6653dc' };
      const tronSnapshot = {
        ...snapshot,
        networkId: tronToken.networkId,
        tokens: [tronToken],
        nativeToken: {
          ...snapshot.nativeToken,
          networkId: tronToken.networkId,
          symbol: 'TRX',
          decimals: 6,
        },
      };
      mockFetchQuote.mockResolvedValue({
        ...createQuote('TSpender'),
        fromTokenInfo: tronToken,
        toTokenInfo: tronSnapshot.nativeToken,
      });
      mockBuild.mockResolvedValue({
        result: {
          ...createQuote('TSpender'),
          fromTokenInfo: tronToken,
          toTokenInfo: tronSnapshot.nativeToken,
        },
      });
      mockAllowance.mockResolvedValueOnce(
        createAllowance({
          isApproved: false,
          allowanceTarget: 'TSpender',
          approveAmounted: '0',
        }),
      );
      mockTxState
        .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.SUCCESS })
        .mockResolvedValue({ state: ESwapTxHistoryStatus.FAILED });
      const swapGas = createTronGasEntry(19_800_000, feeDecimals);
      if (scenario === 'missing-original') swapGas.gasInfo.feeTron = undefined;
      mockEstimateApprovals.mockResolvedValueOnce({
        gasInfos: [createTronGasEntry(18_200_000, feeDecimals)],
      });
      mockEstimate.mockResolvedValueOnce({
        gasInfos: [swapGas],
        preparedUnsignedTx: { encodedTx: {} },
      });
      if (scenario === 'insufficient') {
        mockGasRequirement.mockImplementation(
          jest.requireActual<
            typeof import('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
          >('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
            .getSwapRequiredNativeBalanceAmount,
        );
        mockBalance.mockImplementation(async ({ token: checked, amount }) => ({
          isSufficient: !checked.isNative || Number(amount) <= 1,
          balance: checked.isNative ? '1' : '10',
        }));
      }
      const options = {
        ...createOptions(),
        snapshot: tronSnapshot,
        token: tronToken,
      };
      if (scenario === 'unavailable') {
        mockEstimate.mockReset();
        mockEstimate.mockRejectedValueOnce(
          new Error('Swap estimation unavailable'),
        );
        await expect(
          executeDustSweepItem({
            ...createOptions(),
            snapshot: tronSnapshot,
            token: tronToken,
          }),
        ).rejects.toThrow('Swap estimation unavailable');
        expect(mockEstimateApprovals).toHaveBeenCalledTimes(1);
        expect(mockEstimate).toHaveBeenCalledWith(
          expect.objectContaining({ approveUnsignedTxArr: undefined }),
        );
        expect(mockSend).not.toHaveBeenCalled();
        return;
      }
      if (scenario === 'insufficient' || scenario === 'missing-original') {
        await expect(executeDustSweepItem(options)).rejects.toMatchObject({
          reason: scenario === 'insufficient' ? 'insufficientGas' : 'unknown',
        });
        if (scenario === 'insufficient') {
          expect(mockBalance).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '19.8' }),
          );
        }
        expect(swapGas.gasInfo.common?.baseFee).toBe('0');
        expect(mockSend).not.toHaveBeenCalled();
        expect(options.onSigning).not.toHaveBeenCalled();
        return;
      }
      await expect(
        executeDustSweepItem({
          ...createOptions(),
          snapshot: tronSnapshot,
          token: tronToken,
        }),
      ).resolves.toEqual({ status: 'failed', message: undefined });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: tronToken.networkId,
          buildUnsignedParams: expect.objectContaining({
            approveInfo: expect.any(Object),
          }),
        }),
      );
      expect(mockSend.mock.calls[0][0].buildUnsignedParams.approveInfo).toEqual(
        expect.objectContaining({ spender: 'TSpender', isMax: false }),
      );
      expect(mockEstimateApprovals).toHaveBeenCalledTimes(1);
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ approveUnsignedTxArr: undefined }),
      );
    },
  );

  it('checks native gas before signing an approval', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockBalance.mockImplementation(async ({ token: checkedToken }) =>
      checkedToken.isNative
        ? { isSufficient: false, balance: '0' }
        : { isSufficient: true, balance: '10' },
    );
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toMatchObject({
      reason: 'insufficientGas',
    });
    expect(options.onSigning).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'does not spend approval gas when the full budget is insufficient (reset=%s)',
    async (shouldResetApprove) => {
      mockAllowance.mockResolvedValueOnce(
        createAllowance({ isApproved: false, shouldResetApprove }),
      );
      mockGasRequirement.mockImplementation(
        jest.requireActual<
          typeof import('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
        >('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
          .getSwapRequiredNativeBalanceAmount,
      );
      mockBalance.mockImplementation(async ({ token: checked, amount }) => ({
        isSufficient: !checked.isNative || Number(amount) <= 0.003,
        balance: checked.isNative ? '0.003' : '10',
      }));
      const options = createOptions();
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'insufficientGas',
      });
      expect(mockBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: shouldResetApprove ? '0.007' : '0.006',
        }),
      );
      expect(mockSend).not.toHaveBeenCalled();
      expect(options.onSigning).not.toHaveBeenCalled();
      expect(options.onApprovalBroadcast).not.toHaveBeenCalled();
    },
  );

  it('reserves only the remaining steps while refreshing each approval fee', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, shouldResetApprove: true }),
    );
    mockSend.mockImplementation(async (params) => {
      await params.validateFinalGasInfos?.([createGasEntry('200000')]);
      return sendTransaction({ ...params, validateFinalGasInfos: undefined });
    });
    await executeDustSweepItem(createOptions());
    expect(
      mockGasRequirement.mock.calls.map(([params]) =>
        params.gasInfos?.map((entry) => entry.gasInfo?.gas?.gasLimit),
      ),
    ).toEqual([
      ['100000', '100000', '500000'],
      ['200000', '100000', '500000'],
      ['200000', '500000'],
      ['200000'],
    ]);
    for (const [params] of mockSend.mock.calls) {
      expect(params.buildUnsignedParams.prevNonce).toBeUndefined();
      expect(params.approveUnsignedTxArr).toBeUndefined();
      expect(params.gasInfos).toBeUndefined();
    }
  });

  it('blocks an approval when refreshed gas exceeds the preflight budget', async () => {
    mockAllowance.mockResolvedValueOnce(createAllowance({ isApproved: false }));
    mockGasRequirement.mockImplementation(
      jest.requireActual<
        typeof import('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
      >('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
        .getSwapRequiredNativeBalanceAmount,
    );
    mockBalance.mockImplementation(async ({ token: checked, amount }) => ({
      isSufficient: !checked.isNative || Number(amount) <= 0.007,
      balance: checked.isNative ? '0.007' : '10',
    }));
    mockSend.mockImplementation(async (params) => {
      await params.validateFinalGasInfos?.([createGasEntry('300000')]);
      return sendTransaction({ ...params, validateFinalGasInfos: undefined });
    });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toMatchObject({
      reason: 'insufficientGas',
    });
    expect(options.onSigning).not.toHaveBeenCalled();
    expect(options.onApprovalBroadcast).not.toHaveBeenCalled();
  });

  it('fails before approval if the combined gas estimate is incomplete', async () => {
    mockAllowance.mockResolvedValueOnce(createAllowance({ isApproved: false }));
    mockEstimate.mockResolvedValueOnce({
      gasInfos: [createGasEntry()],
      preparedUnsignedTx: { encodedTx: {} },
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'unknown',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('reserves a grant envelope when reset-required approval cannot be simulated yet', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, shouldResetApprove: true }),
    );
    mockEstimate.mockRejectedValueOnce(new Error('Non-zero allowance'));
    await executeDustSweepItem(createOptions());
    expect(mockEstimate).toHaveBeenCalledTimes(2);
    expect(mockEstimate.mock.calls[1][0].approveUnsignedTxArr).toHaveLength(1);
    expect(
      mockGasRequirement.mock.calls[0][0].gasInfos?.map(
        (entry) => entry.gasInfo?.gas?.gasLimit,
      ),
    ).toEqual(['100000', '200000', '1000000']);
    expect(mockSend).toHaveBeenCalledTimes(3);
    for (const [params] of mockSend.mock.calls) {
      expect(params.gasInfos).toBeUndefined();
      expect(params.approveUnsignedTxArr).toBeUndefined();
      expect(params.buildUnsignedParams.prevNonce).toBeUndefined();
    }
  });

  it('does not sign a reset when its fallback budget is insufficient', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, shouldResetApprove: true }),
    );
    mockEstimate.mockRejectedValueOnce(new Error('Non-zero allowance'));
    mockGasRequirement.mockImplementation(
      jest.requireActual<
        typeof import('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
      >('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
        .getSwapRequiredNativeBalanceAmount,
    );
    mockBalance.mockImplementation(async ({ token: checked, amount }) => ({
      isSufficient: !checked.isNative || Number(amount) <= 0.007,
      balance: checked.isNative ? '0.007' : '10',
    }));
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'insufficientGas',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('includes same-token fees in the source balance check', async () => {
    mockFetchQuote.mockResolvedValue({
      ...createQuote(),
      fee: {
        otherFeeInfos: [
          { token, amount: '0.25' },
          { token, amount: '0.75' },
        ],
      },
    });
    mockBalance.mockImplementation(async ({ amount }) => ({
      isSufficient: amount !== '11',
      balance: '10',
    }));
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'unknown',
    });
    expect(mockBalance).toHaveBeenCalledWith(
      expect.objectContaining({ token, amount: '11' }),
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects an undisclosed non-native fee token in the build', async () => {
    const otherToken = {
      ...token,
      key: 'other',
      contractAddress: '0xother',
      symbol: 'OTHER',
    };
    mockBuild.mockResolvedValue({
      result: {
        ...createQuote(),
        fee: { otherFeeInfos: [{ token: otherToken, amount: '1' }] },
      },
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'unknown',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('preserves a quote rejection without building or signing', async () => {
    const rejection = new DustSweepSkip('priceImpact');
    mockFetchQuote.mockRejectedValueOnce(rejection);
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toBe(rejection);
    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(options.onSigning).not.toHaveBeenCalled();
  });

  it('rejects undisclosed native fees in the build before approval', async () => {
    mockBuild.mockResolvedValue({
      result: {
        ...createQuote(),
        fee: {
          otherFeeInfos: [{ token: snapshot.nativeToken, amount: '0.01' }],
        },
      },
    });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toMatchObject({
      reason: 'unknown',
    });
    expect(mockSend).not.toHaveBeenCalled();
    expect(options.onSigning).not.toHaveBeenCalled();
  });

  it.each([
    '1000000000000000000',
    '0xde0b6b3a7640000',
    '1',
    '0.1',
    '-0.1',
    '0x0.1',
    '1e-1000000001',
    '-1',
    'NaN',
    'Infinity',
    '',
    '0x',
    null,
    false,
  ])(
    'rejects raw EVM value %p before preparing any approval',
    async (value) => {
      mockBuild.mockResolvedValue({
        result: { ...createQuote(), fee: { otherFeeInfos: [] } },
        tx: { to: '0xother', data: '0x', value },
      });
      mockAllowance.mockResolvedValue(createAllowance({ isApproved: false }));
      const options = createOptions();
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'unknown',
      });
      expect(mockPayload).not.toHaveBeenCalled();
      expect(mockAllowance).not.toHaveBeenCalled();
      expect(mockPrepare).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
      expect(options.onSigning).not.toHaveBeenCalled();
      expect(mockHistory).not.toHaveBeenCalled();
    },
  );

  it.each([
    { value: '1000000000000000000' },
    { value: '0xde0b6b3a7640000' },
    { value: '0.1' },
    { value: 'NaN' },
    { value: null },
    '0xserialized',
    [],
  ])(
    'rejects invalid final EVM payload %p from an adapter',
    async (encodedTx) => {
      mockBuild.mockResolvedValue({
        result: createQuote(),
        tx: { to: '0xrouter', data: '0x', value: '0' },
      });
      mockPayload.mockResolvedValue({
        encodedTx,
        swapInfo: {},
        skipSendTransAction: false,
      });
      const options = createOptions();
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'unknown',
      });
      expect(mockAllowance).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
      expect(options.onSigning).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 0, '0', '00', '0x0', '0x00', '0X0'])(
    'accepts zero EVM value %p through the real payload builder',
    async (value) => {
      mockPayload.mockImplementation(
        jest.requireActual<
          typeof import('@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils')
        >(
          '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils',
        ).buildMarketExecutionPayload,
      );
      mockBuild.mockResolvedValue({
        result: createQuote(),
        tx: { to: '0xrouter', data: '0x', value },
      });
      await expect(
        executeDustSweepItem(createOptions()),
      ).resolves.toMatchObject({
        status: 'success',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(
        mockSend.mock.calls[0][0].buildUnsignedParams.encodedTx,
      ).toMatchObject({
        to: '0xrouter',
        value: '0x0',
      });
    },
  );

  it('rejects undisclosed native spend in the rebuild after a confirmed approval', async () => {
    mockAllowance.mockResolvedValueOnce(createAllowance({ isApproved: false }));
    mockPayload
      .mockResolvedValueOnce({ encodedTx: { value: '0x0' }, swapInfo: {} })
      .mockResolvedValueOnce({ encodedTx: { value: '0x1' }, swapInfo: {} });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toMatchObject({
      reason: 'unknown',
    });
    expect(mockPayload).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(
      mockSend.mock.calls[0][0].buildUnsignedParams.approveInfo,
    ).toBeDefined();
    expect(options.onSigning).toHaveBeenCalledTimes(1);
    expect(mockHistory).not.toHaveBeenCalled();
  });

  it.each([
    { protocol: EProtocolOfExchange.LIMIT },
    { protocol: EProtocolOfExchange.STOCK },
    { protocol: EProtocolOfExchange.PRIVATE_SEND },
    { kind: ESwapQuoteKind.BUY },
  ])(
    'rejects a build with a mismatched trade contract: %j',
    async (contract) => {
      mockBuild.mockResolvedValue({
        result: { ...createQuote(), ...contract },
      });
      const options = createOptions();
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'unknown',
      });
      expect(mockPayload).not.toHaveBeenCalled();
      expect(mockAllowance).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
      expect(options.onSigning).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'suppresses notifications before deferred sender post-processing completes (post-processing failure=%s)',
    async (fails) => {
      let releaseSender = () => {};
      const postProcessing = new Promise<void>((resolve) => {
        releaseSender = resolve;
      });
      let observeBroadcast = () => {};
      const broadcast = new Promise<void>((resolve) => {
        observeBroadcast = resolve;
      });
      mockBlockNotification.mockReturnValue(new Promise(() => {}));
      mockSend.mockImplementationOnce(async (params) => {
        await sendTransaction(params);
        observeBroadcast();
        await postProcessing;
        if (fails)
          throw new OneKeyLocalError('History unavailable after broadcast');
        return [];
      });
      const options = createOptions();
      const completion = executeDustSweepItem(options);
      try {
        await broadcast;
        expect(mockBlockNotification).toHaveBeenCalledTimes(1);
        expect(mockBlockNotification).toHaveBeenCalledWith({
          networkId: snapshot.networkId,
          tx: 'swap',
        });
        expect(options.onBroadcast).toHaveBeenCalledWith('swap');
        expect(mockHistory).not.toHaveBeenCalled();
      } finally {
        releaseSender();
        await completion;
      }
      await expect(completion).resolves.toMatchObject({ status: 'success' });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockBlockNotification).toHaveBeenCalledTimes(1);
      expect(mockHistory).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])(
    'suppresses same-chain transfer notifications after broadcast (notification failure=%s)',
    async (fails) => {
      if (fails)
        mockBlockNotification.mockRejectedValue(
          new Error('Notification unavailable'),
        );
      mockSend.mockImplementation(async (params) => {
        expect(mockBlockNotification).not.toHaveBeenCalled();
        return sendTransaction(params);
      });
      await expect(
        executeDustSweepItem(createOptions()),
      ).resolves.toMatchObject({ status: 'success' });
      expect(mockBlockNotification).toHaveBeenCalledWith({
        networkId: snapshot.networkId,
        tx: 'swap',
      });
      expect(mockHistory).toHaveBeenCalledTimes(1);
    },
  );

  describe.each([
    ['evm--1', 'ETH', 18],
    ['tron--0x2b6653dc', 'TRX', 6],
  ] as const)(
    '%s approval response contract',
    (networkId, symbol, decimals) => {
      it.each([
        'absent',
        'explicit-approved',
        'missing-target',
        'unapproved',
        'conflicting-approved',
        'final-gas-reject',
      ] as const)('handles approval metadata: %s', async (approvalState) => {
        const networkToken = { ...token, networkId };
        const networkSnapshot = {
          ...snapshot,
          networkId,
          tokens: [networkToken],
          nativeToken: { ...snapshot.nativeToken, networkId, symbol, decimals },
        };
        let approvedInfo: IFetchQuoteResult['approvedInfo'];
        if (approvalState === 'unapproved')
          approvedInfo = { isApproved: false };
        else if (
          approvalState === 'explicit-approved' ||
          approvalState === 'conflicting-approved'
        )
          approvedInfo = { isApproved: true };
        const quote: IFetchQuoteResult = {
          ...createQuote(),
          fromTokenInfo: networkToken,
          toTokenInfo: networkSnapshot.nativeToken,
          allowanceResult:
            approvalState === 'missing-target' ||
            approvalState === 'conflicting-approved'
              ? { allowanceTarget: '', amount: token.amount }
              : undefined,
          approvedInfo,
        };
        mockFetchQuote.mockResolvedValue(quote);
        mockBuild.mockResolvedValue({ result: quote });
        mockGasRequirement.mockReturnValue({
          token: networkSnapshot.nativeToken,
          amount: '0.1',
          reserveAmount: '0.1',
          includesFromAmount: false,
        });
        const options = {
          ...createOptions(),
          token: networkToken,
          snapshot: networkSnapshot,
        };
        if (approvalState === 'final-gas-reject') {
          mockBalance.mockImplementation(async ({ token: checked }) => ({
            isSufficient: !checked.isNative,
            balance: '0',
          }));
          await expect(executeDustSweepItem(options)).rejects.toMatchObject({
            reason: 'insufficientGas',
          });
          expect(options.onSigning).not.toHaveBeenCalled();
        } else if (
          approvalState !== 'absent' &&
          approvalState !== 'explicit-approved'
        ) {
          await expect(executeDustSweepItem(options)).rejects.toMatchObject({
            reason: 'unknown',
          });
          expect(mockSend).not.toHaveBeenCalled();
          expect(options.onSigning).not.toHaveBeenCalled();
        } else {
          const ordinarySwap = buildSwapReviewState({
            accountId: snapshot.accountId,
            networkId,
            quoteResult: quote,
            swapType: ESwapTabSwitchType.SWAP,
            supportPreBuild: false,
            texts: {
              wrap: 'Wrap',
              approveAndSwap: 'Approve and swap',
              approveAndSign: 'Approve and sign',
              revokeApprove: 'Revoke',
              approveToken: 'Approve',
              approveTokenWithTarget: 'Approve',
              signAndSubmit: 'Sign and submit',
              sign: 'Sign',
              confirmSwap: 'Confirm',
              swap: 'Swap',
            },
          });
          expect(ordinarySwap.steps.map((step) => step.type)).toEqual([
            ESwapStepType.SEND_TX,
          ]);
          await expect(executeDustSweepItem(options)).resolves.toMatchObject({
            status: 'success',
          });
          expect(mockSend).toHaveBeenCalledTimes(1);
          const params = mockSend.mock.calls[0][0];
          expect(params.buildUnsignedParams.approveInfo).toBeUndefined();
          expect(mockGasRequirement).toHaveBeenCalledWith(
            expect.objectContaining({
              networkId,
              fromToken: networkToken,
              fromAmount: networkToken.amount,
            }),
          );
          expect(mockBalance).toHaveBeenCalledWith(
            expect.objectContaining({
              token: networkSnapshot.nativeToken,
              amount: '0.1',
            }),
          );
        }
        expect(mockAllowance).not.toHaveBeenCalled();
        expect(mockPrepare).not.toHaveBeenCalled();
      });
    },
  );

  it.each([false, true])(
    'reserves actual Solana ATA rent before signing (sponsored=%s)',
    async (sponsored) => {
      const solToken = { ...token, networkId: 'sol--101' };
      const solSnapshot = {
        ...snapshot,
        networkId: solToken.networkId,
        tokens: [solToken],
        nativeToken: {
          ...snapshot.nativeToken,
          networkId: solToken.networkId,
          symbol: 'SOL',
          decimals: 9,
        },
      };
      const quote = {
        ...createQuote(),
        fromTokenInfo: solToken,
        toTokenInfo: solSnapshot.nativeToken,
        allowanceResult: undefined,
      };
      mockFetchQuote.mockResolvedValue(quote);
      mockBuild.mockResolvedValue({ result: quote });
      mockGasRequirement.mockImplementation(
        jest.requireActual<
          typeof import('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
        >('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
          .getSwapRequiredNativeBalanceAmount,
      );
      mockBalance.mockImplementation(async ({ token: checked, amount }) => ({
        isSufficient: !checked.isNative || Number(amount) <= 0.001,
        balance: checked.isNative ? '0.001' : solToken.amount,
      }));
      const gas: IMarketGasInfoEntry = {
        encodeTx: {},
        gasInfo: {
          common: {
            baseFee: '0.00002',
            feeDecimals: 9,
            feeSymbol: 'SOL',
            nativeDecimals: 9,
            nativeSymbol: 'SOL',
          },
          feeSol: { computeUnitPrice: '0' },
          payer: sponsored ? 'megafuel' : 'user',
        },
      };
      mockSend.mockImplementation(async (params) => {
        await params.validateFinalGasInfos?.(
          [gas],
          [{ encodedTx: {}, solanaRent: '0.002' }],
        );
        return sendTransaction({ ...params, validateFinalGasInfos: undefined });
      });
      const options = {
        ...createOptions(),
        token: solToken,
        snapshot: solSnapshot,
      };
      await expect(executeDustSweepItem(options)).rejects.toMatchObject({
        reason: 'insufficientGas',
      });
      expect(mockBalance).toHaveBeenCalledWith(
        expect.objectContaining({ amount: sponsored ? '0.002' : '0.00202' }),
      );
      expect(options.onSigning).not.toHaveBeenCalled();
      expect(options.onBroadcast).not.toHaveBeenCalled();
      expect(mockPrepare).not.toHaveBeenCalled();
    },
  );

  it('does not apply EVM value semantics to a Tron payload', async () => {
    const tronToken = { ...token, networkId: 'tron--0x2b6653dc' };
    const tronSnapshot = {
      ...snapshot,
      networkId: tronToken.networkId,
      tokens: [tronToken],
      nativeToken: { ...snapshot.nativeToken, networkId: tronToken.networkId },
    };
    const tronQuote = {
      ...createQuote(),
      fromTokenInfo: tronToken,
      toTokenInfo: tronSnapshot.nativeToken,
    };
    mockFetchQuote.mockResolvedValue(tronQuote);
    mockBuild.mockResolvedValue({ result: tronQuote });
    mockPayload.mockResolvedValue({ encodedTx: { value: '1' }, swapInfo: {} });
    await expect(
      executeDustSweepItem({
        ...createOptions(),
        token: tronToken,
        snapshot: tronSnapshot,
      }),
    ).resolves.toMatchObject({ status: 'success' });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('distinguishes password cancellation from unknown post-sign transport errors', async () => {
    mockSend.mockImplementation(async (params: ISendParams) => {
      await params.onBeforeSignAndSend?.();
      throw Object.assign(new Error('cancelled'), {
        className: EOneKeyErrorClassNames.PasswordPromptDialogCancel,
      });
    });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).rejects.toBeInstanceOf(
      DustSweepUserCanceled,
    );
    expect(options.onPrepared).toHaveBeenCalledTimes(1);
    mockSend.mockImplementation(async (params: ISendParams) => {
      await params.onBeforeSignAndSend?.();
      throw Object.assign(new Error('timeout'), { code: 'ERR_CANCELED' });
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toBeInstanceOf(
      DustSweepUnknownSubmission,
    );
  });

  it('treats hardware and QR cancellation as user cancellation', async () => {
    mockSend.mockImplementation(async (params: ISendParams) => {
      await params.onBeforeSignAndSend?.();
      throw Object.assign(new Error('device rejected'), {
        code: HardwareErrorCode.ActionCancelled,
      });
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toBeInstanceOf(
      DustSweepUserCanceled,
    );

    mockSend.mockImplementation(async (params: ISendParams) => {
      await params.onBeforeSignAndSend?.();
      throw Object.assign(new Error('qr closed'), {
        className: EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
      });
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toBeInstanceOf(
      DustSweepUserCanceled,
    );
  });

  it.each([ESwapTxHistoryStatus.SUCCESS, ESwapTxHistoryStatus.FAILED])(
    'resolves a nonce API error from the exact signed hash to %s without resending',
    async (state) => {
      jest.useFakeTimers();
      const controller = new AbortController();
      const txId = `0x${'12'.repeat(32)}`;
      const message = 'Nonce (265) has already been used; next nonce is 266';
      mockSend.mockImplementationOnce(async (params) => {
        await params.onBeforeSignAndSend?.();
        expect(params.preserveBroadcastTxIdOnError).toBe(true);
        throw withBroadcastTxContext(
          Object.assign(new Error(message), {
            className: EOneKeyErrorClassNames.OneKeyServerApiError,
            code: 40_024,
          }),
          { networkId: snapshot.networkId, txId },
        );
      });
      mockTxState
        .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.PENDING })
        .mockResolvedValueOnce({
          state,
          dealReceiveAmount: '0.009',
          blockNumber:
            state === ESwapTxHistoryStatus.FAILED ? 12_345 : undefined,
        })
        .mockResolvedValue({ state: ESwapTxHistoryStatus.PENDING });
      const options = { ...createOptions(), signal: controller.signal };
      let outcome: unknown;
      const completion = executeDustSweepItem(options).then(
        (result) => {
          outcome = result;
        },
        (error: unknown) => {
          outcome = error;
        },
      );
      try {
        await jest.advanceTimersByTimeAsync(0);
        expect(options.onSigning).toHaveBeenCalledTimes(1);
        expect(options.onSubmissionError).toHaveBeenCalledWith(message);
        expect(options.onBroadcast).not.toHaveBeenCalled();
        expect(mockBlockNotification).not.toHaveBeenCalled();
        expect(options.onPrepared).not.toHaveBeenCalled();
        expect(mockHistory).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(3000);
        expect(outcome).toMatchObject({
          status: state === ESwapTxHistoryStatus.SUCCESS ? 'success' : 'failed',
        });
        expect(options.onBroadcast).toHaveBeenCalledTimes(1);
        expect(options.onBroadcast).toHaveBeenCalledWith(txId);
        expect(mockBlockNotification).toHaveBeenCalledTimes(1);
        expect(mockBlockNotification).toHaveBeenCalledWith({
          networkId: snapshot.networkId,
          tx: txId,
        });
        expect(mockHistory).toHaveBeenCalledTimes(1);
        expect(mockHistory).toHaveBeenCalledWith(
          expect.objectContaining({ txId }),
        );
        expect(mockTxState).toHaveBeenCalledTimes(2);
        expect(
          mockTxState.mock.calls.every(([params]) => params.txId === txId),
        ).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        controller.abort();
        await completion;
        jest.useRealTimers();
      }
    },
  );

  describe.each(['swap', 'approval'] as const)('recovered %s hash', (kind) => {
    const txId = `0x${'34'.repeat(32)}`;
    const message = 'Nonce (265) has already been used; next nonce is 266';

    beforeEach(() => {
      if (kind === 'approval') {
        mockAllowance.mockResolvedValueOnce(
          createAllowance({ isApproved: false, approveAmounted: '0' }),
        );
      }
      mockSend.mockImplementationOnce(async (params) => {
        await params.onBeforeSignAndSend?.();
        throw withBroadcastTxContext(
          Object.assign(new OneKeyLocalError(message), {
            className: EOneKeyErrorClassNames.OneKeyServerApiError,
            code: 40_024,
          }),
          { networkId: snapshot.networkId, txId },
        );
      });
    });

    it.each([
      { scenario: 'pending', blockNumber: undefined },
      ...[undefined, 0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY].map(
        (blockNumber) => ({
          scenario: 'failed-without-valid-block',
          blockNumber,
        }),
      ),
      { scenario: 'transport-error', blockNumber: undefined },
      { scenario: 'hung-read', blockNumber: undefined },
    ])(
      'blocks within 60 seconds for $scenario (blockNumber=$blockNumber) without recording a broadcast or resending',
      async ({ scenario, blockNumber }) => {
        jest.useFakeTimers();
        const controller = new AbortController();
        const options = { ...createOptions(), signal: controller.signal };
        let resolveRead:
          | ((value: Awaited<ReturnType<typeof mockTxState>>) => void)
          | undefined;
        if (scenario === 'pending') {
          mockTxState.mockResolvedValue({
            state: ESwapTxHistoryStatus.PENDING,
          });
        } else if (scenario === 'failed-without-valid-block') {
          mockTxState.mockResolvedValue({
            state: ESwapTxHistoryStatus.FAILED,
            blockNumber,
          });
        } else if (scenario === 'transport-error') {
          mockTxState.mockRejectedValue(
            new OneKeyLocalError('RPC unavailable'),
          );
        } else {
          mockTxState.mockImplementation(
            () =>
              new Promise((resolve) => {
                resolveRead = resolve;
              }),
          );
        }
        let outcome: unknown;
        const completion = executeDustSweepItem(options).then(
          (result) => {
            outcome = result;
          },
          (error: unknown) => {
            outcome = error;
          },
        );
        try {
          await jest.advanceTimersByTimeAsync(59_999);
          expect(outcome).toBeUndefined();
          await jest.advanceTimersByTimeAsync(1);
          expect(outcome).toBeInstanceOf(DustSweepUnknownSubmission);
          expect(outcome).toMatchObject({ submissionErrorMessage: message });
          expect(controller.signal.aborted).toBe(false);
          expect(options.onSigning).toHaveBeenCalledTimes(1);
          expect(options.onSubmissionError).toHaveBeenCalledWith(message);
          expect(options.onBroadcast).not.toHaveBeenCalled();
          expect(options.onApprovalBroadcast).not.toHaveBeenCalled();
          expect(options.onPrepared).not.toHaveBeenCalled();
          expect(mockHistory).not.toHaveBeenCalled();
          expect(mockSend).toHaveBeenCalledTimes(1);
          expect(
            mockTxState.mock.calls.every(([params]) => params.txId === txId),
          ).toBe(true);
          const pollsAtDeadline = mockTxState.mock.calls.length;
          resolveRead?.({ state: ESwapTxHistoryStatus.SUCCESS });
          await jest.advanceTimersByTimeAsync(60_000);
          expect(mockTxState).toHaveBeenCalledTimes(pollsAtDeadline);
          expect(mockHistory).not.toHaveBeenCalled();
          expect(options.onBroadcast).not.toHaveBeenCalled();
          expect(options.onApprovalBroadcast).not.toHaveBeenCalled();
          expect(mockSend).toHaveBeenCalledTimes(1);
          expect(jest.getTimerCount()).toBe(0);
        } finally {
          controller.abort();
          await completion;
          jest.useRealTimers();
        }
      },
    );

    it('cleans up its confirmation deadline when its parent aborts', async () => {
      jest.useFakeTimers();
      const controller = new AbortController();
      const options = { ...createOptions(), signal: controller.signal };
      mockTxState.mockImplementation(() => new Promise(() => {}));
      const completion = executeDustSweepItem(options).catch(
        (error: unknown) => error,
      );
      try {
        await jest.advanceTimersByTimeAsync(0);
        expect(mockTxState).toHaveBeenCalledTimes(1);
        controller.abort();
        const outcome: unknown = await completion;
        expect(outcome).toBeInstanceOf(DustSweepUnknownSubmission);
        expect(outcome).toMatchObject({ submissionErrorMessage: message });
        expect(jest.getTimerCount()).toBe(0);
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockTxState).toHaveBeenCalledTimes(1);
        expect(options.onBroadcast).not.toHaveBeenCalled();
        expect(options.onApprovalBroadcast).not.toHaveBeenCalled();
        expect(options.onPrepared).not.toHaveBeenCalled();
        expect(mockHistory).not.toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
      } finally {
        controller.abort();
        await completion;
        jest.useRealTimers();
      }
    });
  });

  it.each([ESwapTxHistoryStatus.SUCCESS, ESwapTxHistoryStatus.FAILED])(
    'confirms a recovered approval as %s before retaining it or signing a swap',
    async (state) => {
      jest.useFakeTimers();
      const controller = new AbortController();
      const txId = `0x${'56'.repeat(32)}`;
      mockAllowance.mockResolvedValueOnce(
        createAllowance({ isApproved: false, approveAmounted: '0' }),
      );
      mockSend.mockImplementationOnce(async (params) => {
        await params.onBeforeSignAndSend?.();
        throw withBroadcastTxContext(new OneKeyLocalError('timeout'), {
          networkId: snapshot.networkId,
          txId,
        });
      });
      mockTxState
        .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.PENDING })
        .mockResolvedValueOnce({
          state,
          blockNumber:
            state === ESwapTxHistoryStatus.FAILED ? 12_345 : undefined,
        });
      const options = { ...createOptions(), signal: controller.signal };
      let outcome: unknown;
      const completion = executeDustSweepItem(options).then(
        (result) => {
          outcome = result;
        },
        (error: unknown) => {
          outcome = error;
        },
      );
      try {
        await jest.advanceTimersByTimeAsync(0);
        expect(options.onApprovalBroadcast).not.toHaveBeenCalled();
        expect(options.onPrepared).not.toHaveBeenCalled();
        expect(options.onBroadcast).not.toHaveBeenCalled();
        expect(mockHistory).not.toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(3000);
        expect(options.onApprovalBroadcast).toHaveBeenCalledTimes(1);
        expect(options.onApprovalBroadcast).toHaveBeenCalledWith([txId]);
        expect(options.onBroadcast).not.toHaveBeenCalledWith(txId);
        expect(
          mockTxState.mock.calls.filter(([params]) => params.txId === txId),
        ).toHaveLength(2);
        if (state === ESwapTxHistoryStatus.SUCCESS) {
          expect(outcome).toMatchObject({ status: 'success' });
          expect(options.onBroadcast).toHaveBeenCalledWith('swap');
          expect(mockSend).toHaveBeenCalledTimes(2);
          expect(mockHistory).toHaveBeenCalledTimes(1);
          expect(mockHistory).toHaveBeenCalledWith(
            expect.objectContaining({ txId: 'swap' }),
          );
        } else {
          expect(outcome).toBeInstanceOf(DustSweepSkip);
          expect(outcome).toMatchObject({ reason: 'txFailed' });
          expect(options.onBroadcast).not.toHaveBeenCalled();
          expect(mockSend).toHaveBeenCalledTimes(1);
          expect(mockHistory).not.toHaveBeenCalled();
        }
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        controller.abort();
        await completion;
        jest.useRealTimers();
      }
    },
  );

  it('preserves the API message but blocks a submission with no usable signed hash', async () => {
    const message = 'Nonce (265) has already been used';
    mockSend.mockImplementationOnce(async (params) => {
      await params.onBeforeSignAndSend?.();
      throw Object.assign(new Error(message), {
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 40_024,
      });
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      submissionErrorMessage: message,
    });
    expect(mockTxState).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'does not classify an EVM slippage response as a Solana rejection (hash: %s)',
    async (hasHash) => {
      const txId = `0x${'78'.repeat(32)}`;
      mockSend.mockImplementationOnce(async (params) => {
        await params.onBeforeSignAndSend?.();
        const error = Object.assign(new Error('Slippage exceeded'), {
          className: EOneKeyErrorClassNames.OneKeyServerApiError,
          code: 40_036,
        });
        throw hasHash
          ? withBroadcastTxContext(error, {
              networkId: snapshot.networkId,
              txId,
            })
          : error;
      });
      const options = createOptions();
      const operation = executeDustSweepItem(options);
      if (hasHash) {
        await expect(operation).resolves.toMatchObject({ status: 'success' });
        expect(mockTxState).toHaveBeenCalledWith(
          expect.objectContaining({ txId }),
        );
        expect(options.onBroadcast).toHaveBeenCalledWith(txId);
        expect(mockHistory).toHaveBeenCalledTimes(1);
      } else {
        await expect(operation).rejects.toBeInstanceOf(
          DustSweepUnknownSubmission,
        );
        expect(mockTxState).not.toHaveBeenCalled();
        expect(options.onBroadcast).not.toHaveBeenCalled();
        expect(mockHistory).not.toHaveBeenCalled();
      }
      expect(mockSend).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps a broadcast successful when the send history write fails', async () => {
    mockSend.mockImplementation(async (params: ISendParams) => {
      await sendTransaction(params);
      throw new OneKeyLocalError('history unavailable');
    });
    const options = createOptions();
    await expect(executeDustSweepItem(options)).resolves.toEqual({
      status: 'success',
      receivedAmount: '0.009',
      receiptUnavailable: false,
    });
    expect(options.onBroadcast).toHaveBeenCalledWith('swap');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockHistory).toHaveBeenCalledWith(
      expect.objectContaining({ txId: 'swap' }),
    );
  });

  it('completes a terminal success with an unavailable receipt without claiming zero', async () => {
    mockTxState.mockResolvedValue({ state: ESwapTxHistoryStatus.SUCCESS });
    await expect(executeDustSweepItem(createOptions())).resolves.toEqual({
      status: 'success',
      receiptUnavailable: true,
      receivedAmount: undefined,
    });
    expect(mockTxState).toHaveBeenCalledTimes(1);
  });

  it('keeps long pending broadcasts pending without a resend', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    mockTxState.mockResolvedValue({ state: ESwapTxHistoryStatus.PENDING });
    const operation = executeDustSweepItem({
      ...createOptions(),
      signal: controller.signal,
    });
    const completion = operation.catch((error: unknown) => error);
    try {
      await jest.advanceTimersByTimeAsync(90_000);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockTxState.mock.calls.length).toBeGreaterThan(20);
    } finally {
      controller.abort();
      const result = await completion;
      jest.useRealTimers();
      expect(result).toBeInstanceOf(OneKeyLocalError);
      expect(result).toMatchObject({ message: 'Dust Sweep cancelled' });
    }
  });

  it('aborts after preparation before any signature', async () => {
    const controller = new AbortController();
    mockSend.mockImplementation(async (params: ISendParams) => {
      controller.abort();
      await params.onBeforeSignAndSend?.();
      return [];
    });
    const options = { ...createOptions(), signal: controller.signal };
    await expect(executeDustSweepItem(options)).rejects.not.toBeInstanceOf(
      DustSweepUnknownSubmission,
    );
    expect(options.onSigning).not.toHaveBeenCalled();
    expect(options.onBroadcast).not.toHaveBeenCalled();
  });
});
