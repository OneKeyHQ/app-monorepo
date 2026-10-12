import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { sendMarketDirectUnsignedTxs } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
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
const mockHistory = jest.fn();
const mockBalance = jest.fn();
const mockGasRequirement = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
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
  () => ({ sendMarketDirectUnsignedTxs: mockSend }),
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
    generateSwapHistoryItem: jest.fn(),
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
    mockHistory.mockReset().mockResolvedValue(undefined);
    mockBalance
      .mockReset()
      .mockResolvedValue({ isSufficient: true, balance: '100' });
    mockGasRequirement
      .mockReset()
      .mockReturnValue({ token: snapshot.nativeToken, amount: '0.1' });
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

  it('rebuilds after confirmed approval and sends the swap with fresh gas', async () => {
    mockFetchQuote.mockResolvedValue(createQuote('0xfirst'));
    mockAllowance.mockResolvedValueOnce(
      createAllowance({
        isApproved: false,
        allowanceTarget: '0xfirst',
        approveAmounted: '0',
      }),
    );
    mockBuild.mockResolvedValue({ result: createQuote('0xfirst') });
    const options = createOptions();
    await executeDustSweepItem(options);
    expect(options.onSigning).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(
      mockSend.mock.calls[0][0].buildUnsignedParams.approveInfo,
    ).toBeDefined();
    expect(mockSend.mock.calls[1][0].approveUnsignedTxArr).toBeUndefined();
    expect(mockAllowance).toHaveBeenCalledWith(
      expect.objectContaining({ spenderAddress: '0xfirst' }),
    );
    expect(mockFetchQuote).toHaveBeenCalledTimes(2);
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

  it('uses only the refreshed build after approval confirmation', async () => {
    mockAllowance.mockResolvedValueOnce(createAllowance({ isApproved: false }));
    mockBuild
      .mockResolvedValueOnce({
        result: createQuote(),
        ctx: { order: 'before' },
      })
      .mockResolvedValueOnce({
        result: createQuote(),
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
        expect(mockBuild).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
      }
      return {
        state: ESwapTxHistoryStatus.SUCCESS,
        dealReceiveAmount: '0.009',
      };
    });
    await executeDustSweepItem(createOptions());
    expect(mockSend.mock.calls[1][0]).toMatchObject({
      buildUnsignedParams: { encodedTx: { data: 'fresh' } },
    });
    expect(mockSend.mock.calls[1][0].gasInfos).toBeUndefined();
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
    mockTxState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirmReset = resolve;
        }),
    );
    const completion = executeDustSweepItem(createOptions());
    for (let turn = 0; turn < 30 && !mockTxState.mock.calls.length; turn += 1)
      await Promise.resolve();
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

  it('supports quote-owned Tron approvals', async () => {
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
  });

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

  it('includes same-token fees in the source balance check', async () => {
    mockFetchQuote.mockResolvedValue({
      ...createQuote(),
      fee: { otherFeeInfos: [{ token, amount: '1' }] },
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

  it('rejects an undisclosed non-native fee token', async () => {
    const otherToken = {
      ...token,
      key: 'other',
      contractAddress: '0xother',
      symbol: 'OTHER',
    };
    mockFetchQuote.mockResolvedValue({
      ...createQuote(),
      fee: { otherFeeInfos: [{ token: otherToken, amount: '1' }] },
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'unknown',
    });
    expect(mockSend).not.toHaveBeenCalled();
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
