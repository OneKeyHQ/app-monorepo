/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { sendMarketDirectUnsignedTxs } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import type { completeBroadcastedSwapSuccess } from '@onekeyhq/kit/src/views/Swap/hooks/swapBroadcastSuccess';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { getDustSweepPresentation } from '../stateMachine';

import { useDustSweepSession } from './useDustSweepSession';

const mockSend: jest.MockedFunction<typeof sendMarketDirectUnsignedTxs> =
  jest.fn();
const mockHistory: jest.MockedFunction<typeof completeBroadcastedSwapSuccess> =
  jest.fn();
const mockResult = jest.fn();
const mockTxState: jest.MockedFunction<
  typeof backgroundApiProxy.serviceSwap.fetchTxState
> = jest.fn();
const mockBuild = jest.fn(
  async ({ fromToken }: { fromToken: IDustSweepToken }) => ({
    result: mockQuote(fromToken),
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: { blockNotificationForTxId: async () => undefined },
    serviceSwap: {
      fetchBuildTx: (...args: Parameters<typeof mockBuild>) =>
        mockBuild(...args),
      fetchTxState: (...args: Parameters<typeof mockTxState>) =>
        mockTxState(...args),
    },
  },
}));
jest.mock('../utils/quote', () => ({
  ...jest.requireActual<typeof import('../utils/quote')>('../utils/quote'),
  fetchDustSweepQuote: async (token: IDustSweepToken) => mockQuote(token),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils',
  () => ({
    buildMarketExecutionPayload: async ({
      currentFromToken,
    }: {
      currentFromToken: IDustSweepToken;
    }) => ({ encodedTx: { token: currentFromToken.symbol }, swapInfo: {} }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx',
  () => ({
    sendMarketDirectUnsignedTxs: (...args: unknown[]) =>
      mockSend(...(args as Parameters<typeof sendMarketDirectUnsignedTxs>)),
    MarketDirectFeeOverflowError: class extends Error {},
  }),
);
jest.mock('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils')
  >('@onekeyhq/kit/src/views/Swap/utils/swapBalanceUtils'),
  checkSwapLatestBalanceSufficient: async () => ({
    isSufficient: true,
    balance: '100',
  }),
  getSwapRequiredNativeBalanceAmount: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/views/Swap/hooks/swapBroadcastSuccess', () => ({
  completeBroadcastedSwapSuccess: (...args: Parameters<typeof mockHistory>) =>
    mockHistory(...args),
}));
jest.mock('@onekeyhq/kit/src/views/Swap/hooks/useSwapTxHistory', () => ({
  generateSwapHistoryItemForContext: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      dustSweep: {
        dustSweepResult: (...args: unknown[]) => {
          mockResult(...args);
        },
        dustSweepStart: jest.fn(),
        dustSweepPageVisited: jest.fn(),
        dustSweepItemResult: jest.fn(),
      },
    },
  },
}));

const snapshot: IDustSweepSnapshot = {
  id: 'sol-rejection',
  accountId: 'account',
  address: 'address',
  networkId: 'sol--101',
  slippage: 5,
  nativeToken: {
    networkId: 'sol--101',
    contractAddress: '',
    symbol: 'SOL',
    decimals: 9,
    isNative: true,
    price: '100',
  },
  tokens: ['PUMP', 'ZEC', 'USDT'].map((symbol) => ({
    key: symbol,
    networkId: 'sol--101',
    contractAddress: symbol,
    symbol,
    decimals: 6,
    amount: '1',
    valueUsd: '1',
    price: '1',
    suspicious: false,
  })),
};
const message =
  'Transaction submission failed. Try increasing the slippage and try again.';
function rejection() {
  // The main/bg bridge restores these fields, not the original Error prototype.
  return {
    className: EOneKeyErrorClassNames.OneKeyServerApiError,
    code: 40_036,
    message,
  };
}
function mockQuote(token: IDustSweepToken) {
  return {
    info: { provider: 'SwapOKX', providerName: 'OKX' },
    fromTokenInfo: token,
    toTokenInfo: snapshot.nativeToken,
    fromAmount: token.amount,
    toAmount: '0.01',
  };
}
async function broadcast(
  params: Parameters<typeof sendMarketDirectUnsignedTxs>[0],
) {
  params.onBroadcast?.({
    txid: `tx-${mockSend.mock.calls.length}`,
    rawTx: '',
    encodedTx: null,
  });
  return [];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBuild.mockReset().mockImplementation(async ({ fromToken }) => ({
    result: mockQuote(fromToken),
  }));
  mockTxState.mockResolvedValue({
    state: ESwapTxHistoryStatus.SUCCESS,
    dealReceiveAmount: '0.01',
  });
  mockHistory.mockResolvedValue(undefined);
});

it('preserves a bridge API build failure through the real executor and session', async () => {
  mockBuild.mockRejectedValueOnce({
    ...rejection(),
    message: 'API build failed',
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () =>
    result.current.start({ ...snapshot, tokens: [snapshot.tokens[0]] }),
  );
  expect(result.current.state.items[0]).toMatchObject({
    status: 'skipped',
    reason: 'unknown',
    providerErrorMessage: 'API build failed',
  });
  expect(mockSend).not.toHaveBeenCalled();
});

it('discounts only missing receipts in a batch with actual amounts including zero', async () => {
  mockTxState
    .mockResolvedValueOnce({
      state: ESwapTxHistoryStatus.SUCCESS,
      dealReceiveAmount: '0.012',
    })
    .mockResolvedValueOnce({ state: ESwapTxHistoryStatus.SUCCESS })
    .mockResolvedValueOnce({
      state: ESwapTxHistoryStatus.SUCCESS,
      dealReceiveAmount: '0',
    });
  mockSend.mockImplementation(async (params) => {
    await params.onBeforeSignAndSend?.();
    return broadcast(params);
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.items.map((item) => item.receivedAmount)).toEqual(
    ['0.012', '0.0095', '0'],
  );
  expect(
    result.current.state.items.map((item) => item.receivedAmountEstimated),
  ).toEqual([undefined, true, undefined]);
  expect(getDustSweepPresentation(result.current.state)).toMatchObject({
    outcome: 'success',
    totals: {
      receivedAmount: '0.0215',
      receivedAmountEstimated: true,
      receiptUnavailable: false,
      successCount: 3,
    },
  });
  expect(mockResult).toHaveBeenCalledWith(
    expect.objectContaining({
      receiptAvailable: false,
      receivedAmount: null,
      receivedUsd: null,
    }),
  );
});

it.each(['preparation', 'submission', 'confirmation'] as const)(
  'collects a %s request failure and completes the remaining tokens',
  async (phase) => {
    const error = Object.assign(new Error('Request rejected'), rejection(), {
      code: 40_024,
      message: 'Request rejected',
    });
    mockSend.mockImplementation(async (params) => {
      const first = mockSend.mock.calls.length === 1;
      if (first && phase === 'preparation') throw error;
      await params.onBeforeSignAndSend?.();
      if (first && phase === 'submission') throw error;
      return broadcast(params);
    });
    if (phase === 'confirmation') mockTxState.mockRejectedValueOnce(error);
    const { result } = renderHook(() =>
      useDustSweepSession([], { minRunMs: 0 }),
    );
    await act(async () => result.current.start(snapshot));
    expect(result.current.state.phase).toBe('completed');
    expect(result.current.state.items.map((item) => item.status)).toEqual([
      'skipped',
      'success',
      'success',
    ]);
    expect(result.current.state.items[0]).toMatchObject({
      providerErrorMessage: error.message,
      reason: 'unknown',
    });
    expect(result.current.state.items[0].txId).toBe(
      phase === 'confirmation' ? 'tx-1' : undefined,
    );
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockHistory).toHaveBeenCalledTimes(phase === 'confirmation' ? 3 : 2);
    expect(getDustSweepPresentation(result.current.state)).toMatchObject({
      outcome: 'partial',
      totals: { settledCount: 3, successCount: 2, skippedCount: 1 },
    });
    if (phase === 'confirmation')
      expect(mockResult).toHaveBeenCalledWith(
        expect.objectContaining({
          receiptAvailable: false,
          receivedAmount: null,
          receivedUsd: null,
        }),
      );
    await act(async () => result.current.resume());
    expect(mockSend).toHaveBeenCalledTimes(3);
    await act(async () => result.current.leave());
    expect(result.current.state.phase).toBe('left');
  },
);

it('settles all rejected tokens without waiting, history writes or a resume action', async () => {
  mockSend.mockImplementation(async (params) => {
    await params.onBeforeSignAndSend?.();
    throw rejection();
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('completed');
  expect(getDustSweepPresentation(result.current.state)).toMatchObject({
    outcome: 'failed',
    totals: { settledCount: 3, skippedCount: 3 },
  });
  expect(mockSend).toHaveBeenCalledTimes(3);
  expect(mockHistory).not.toHaveBeenCalled();
  expect(mockTxState).not.toHaveBeenCalled();
});

it('collects a sender failure after broadcast without losing transaction identity', async () => {
  mockSend.mockImplementation(async (params) => {
    await params.onBeforeSignAndSend?.();
    await broadcast(params);
    throw rejection();
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('completed');
  expect(result.current.state.items.map((item) => item.status)).toEqual([
    'skipped',
    'skipped',
    'skipped',
  ]);
  expect(mockSend).toHaveBeenCalledTimes(3);
  expect(mockHistory).toHaveBeenCalledTimes(3);
  expect(mockTxState).not.toHaveBeenCalled();
  expect(result.current.state.items.every((item) => item.txId)).toBe(true);
  expect(
    result.current.state.items.every(
      (item) => item.providerErrorMessage === message,
    ),
  ).toBe(true);
  expect(mockResult).toHaveBeenCalledWith(
    expect.objectContaining({ receiptAvailable: false }),
  );
  await act(async () => result.current.leave());
  expect(result.current.state.phase).toBe('left');
});

it('honors a pause while the rejected submission is outstanding, then continues only the next token', async () => {
  let rejectSend!: (error: unknown) => void;
  mockSend
    .mockImplementationOnce(async (params) => {
      await params.onBeforeSignAndSend?.();
      return new Promise((_, reject) => {
        rejectSend = reject;
      });
    })
    .mockImplementation(async (params) => {
      await params.onBeforeSignAndSend?.();
      return broadcast(params);
    });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  act(() => result.current.pause());
  await act(async () => rejectSend(rejection()));
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items.map((item) => item.status)).toEqual([
    'skipped',
    'waiting',
    'waiting',
  ]);
  expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => result.current.resume());
  expect(result.current.state.phase).toBe('completed');
  expect(mockSend).toHaveBeenCalledTimes(3);
});

it('exposes the confirmed provider failure detail in the final result', async () => {
  mockTxState.mockResolvedValueOnce({
    state: ESwapTxHistoryStatus.FAILED,
    stateDetail: 'Swap route execution reverted',
  });
  mockSend.mockImplementation(async (params) => {
    await params.onBeforeSignAndSend?.();
    return broadcast(params);
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.items[0]).toMatchObject({
    status: 'failed',
    reason: 'txFailed',
    providerErrorMessage: 'Swap route execution reverted',
  });
});

it('preserves localized signing errors in the existing collector and finishes', async () => {
  mockSend.mockImplementation(async (params) => {
    await params.onBeforeSignAndSend?.();
    throw new OneKeyLocalError({
      key: ETranslations.swap_page_toast_insufficient_balance_title,
      info: { token: 'SOL' },
    });
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('completed');
  expect(result.current.state.items[0]).toMatchObject({
    status: 'skipped',
    localError: {
      key: ETranslations.swap_page_toast_insufficient_balance_title,
      values: { token: 'SOL' },
    },
  });
  await act(async () => result.current.resume());
  expect(mockSend).toHaveBeenCalledTimes(3);
});
