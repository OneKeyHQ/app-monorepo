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
    onBroadcast: jest.fn(),
    generateSwapHistoryItem: jest.fn(),
  };
}
async function sendTransaction(params: ISendParams) {
  await params.validateFinalGasInfos?.([]);
  params.onBeforeSignAndSend?.();
  params.onBroadcast?.({
    txid: params.buildUnsignedParams.approveInfo ? 'approval' : 'swap',
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

  it('re-quotes after approval and rechecks the new spender before building', async () => {
    mockFetchQuote
      .mockResolvedValueOnce(createQuote('0xfirst'))
      .mockResolvedValue(createQuote('0xsecond'));
    mockAllowance
      .mockResolvedValue(createAllowance({ allowanceTarget: '0xsecond' }))
      .mockResolvedValueOnce(
        createAllowance({
          isApproved: false,
          allowanceTarget: '0xfirst',
          approveAmounted: '0',
        }),
      )
      .mockResolvedValueOnce(createAllowance({ allowanceTarget: '0xfirst' }));
    mockBuild.mockResolvedValue({ result: createQuote('0xsecond') });
    await executeDustSweepItem(createOptions());
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockAllowance).toHaveBeenCalledWith(
      expect.objectContaining({ spenderAddress: '0xsecond' }),
    );
    expect(mockFetchQuote).toHaveBeenCalledTimes(2);
    expect(mockAllowance.mock.invocationCallOrder[2]).toBeLessThan(
      mockBuild.mock.invocationCallOrder[0],
    );
  });

  it('does not approve a new spender introduced by the build response', async () => {
    mockBuild.mockResolvedValue({ result: createQuote('0xchanged') });
    mockAllowance
      .mockResolvedValueOnce(createAllowance())
      .mockResolvedValueOnce(
        createAllowance({
          isApproved: false,
          allowanceTarget: '0xchanged',
          approveAmounted: '0',
        }),
      );
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'unknown',
    });
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

  it('stops a failed approval without polling forever or sending the swap', async () => {
    mockAllowance.mockResolvedValueOnce(
      createAllowance({ isApproved: false, approveAmounted: '0' }),
    );
    mockTxState.mockResolvedValue({ state: ESwapTxHistoryStatus.FAILED });
    await expect(executeDustSweepItem(createOptions())).rejects.toMatchObject({
      reason: 'txFailed',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('settles a reset approval before granting the exact new allowance', async () => {
    mockAllowance
      .mockResolvedValueOnce(
        createAllowance({
          isApproved: false,
          approveAmounted: '1',
          shouldResetApprove: true,
        }),
      )
      .mockResolvedValueOnce(
        createAllowance({ isApproved: false, approveAmounted: '0' }),
      )
      .mockResolvedValueOnce(createAllowance());
    await executeDustSweepItem(createOptions());
    expect(
      mockSend.mock.calls.map(
        ([params]: [ISendParams]) =>
          params.buildUnsignedParams.approveInfo?.amount,
      ),
    ).toEqual(['0', '10', undefined]);
    expect(mockTxState.mock.invocationCallOrder[0]).toBeLessThan(
      mockSend.mock.invocationCallOrder[1],
    );
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
    mockAllowance.mockResolvedValueOnce(
      createAllowance({
        isApproved: false,
        allowanceTarget: 'TSpender',
        approveAmounted: '0',
      }),
    );
    mockTxState.mockResolvedValue({ state: ESwapTxHistoryStatus.FAILED });
    await expect(
      executeDustSweepItem({
        ...createOptions(),
        snapshot: tronSnapshot,
        token: tronToken,
      }),
    ).rejects.toMatchObject({ reason: 'txFailed' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: tronToken.networkId,
        buildUnsignedParams: expect.objectContaining({
          approveInfo: expect.objectContaining({
            spender: 'TSpender',
            isMax: false,
          }),
        }),
      }),
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

  it('distinguishes password cancellation from unknown post-sign transport errors', async () => {
    mockSend.mockImplementation(async (params: ISendParams) => {
      params.onBeforeSignAndSend?.();
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
      params.onBeforeSignAndSend?.();
      throw Object.assign(new Error('timeout'), { code: 'ERR_CANCELED' });
    });
    await expect(executeDustSweepItem(createOptions())).rejects.toBeInstanceOf(
      DustSweepUnknownSubmission,
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
      params.onBeforeSignAndSend?.();
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
