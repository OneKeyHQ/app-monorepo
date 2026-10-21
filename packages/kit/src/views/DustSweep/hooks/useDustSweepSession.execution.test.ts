/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { sendMarketDirectUnsignedTxs } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import type { completeBroadcastedSwapSuccess } from '@onekeyhq/kit/src/views/Swap/hooks/swapBroadcastSuccess';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
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

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchBuildTx: async ({ fromToken }: { fromToken: IDustSweepToken }) => ({
        result: mockQuote(fromToken),
      }),
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
  mockTxState.mockResolvedValue({
    state: ESwapTxHistoryStatus.SUCCESS,
    dealReceiveAmount: '0.01',
  });
  mockHistory.mockResolvedValue(undefined);
});

it.each([0, 1, 2])(
  'settles a rejection at index %s and continues the real executor/session through the final result',
  async (failedIndex) => {
    mockSend.mockImplementation(async (params) => {
      await params.onBeforeSignAndSend?.();
      if (mockSend.mock.calls.length - 1 === failedIndex) throw rejection();
      return broadcast(params);
    });
    const { result } = renderHook(() =>
      useDustSweepSession([], { minRunMs: 0 }),
    );
    await act(async () => result.current.start(snapshot));
    expect(result.current.state.phase).toBe('completed');
    expect(result.current.state.items.map((item) => item.status)).toEqual(
      snapshot.tokens.map((_, index) =>
        index === failedIndex ? 'failed' : 'success',
      ),
    );
    expect(result.current.state.items[failedIndex]).toMatchObject({
      message,
      reason: 'txFailed',
    });
    expect(result.current.state.items[failedIndex].txId).toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockHistory).toHaveBeenCalledTimes(2);
    expect(mockTxState).toHaveBeenCalledTimes(2);
    expect(getDustSweepPresentation(result.current.state)).toMatchObject({
      outcome: 'partial',
      totals: { settledCount: 3, successCount: 2, failedCount: 1 },
    });
    expect(mockResult).toHaveBeenCalledTimes(1);
    await act(async () => result.current.resume());
    expect(mockSend).toHaveBeenCalledTimes(3);
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
    totals: { settledCount: 3, failedCount: 3 },
  });
  expect(mockSend).toHaveBeenCalledTimes(3);
  expect(mockHistory).not.toHaveBeenCalled();
  expect(mockTxState).not.toHaveBeenCalled();
});

it('retains an acknowledged Solana broadcast even if later work reports a slippage error', async () => {
  mockSend.mockImplementation(async (params) => {
    await params.onBeforeSignAndSend?.();
    await broadcast(params);
    throw rejection();
  });
  const { result } = renderHook(() => useDustSweepSession([], { minRunMs: 0 }));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('completed');
  expect(result.current.state.items.map((item) => item.status)).toEqual([
    'success',
    'success',
    'success',
  ]);
  expect(mockSend).toHaveBeenCalledTimes(3);
  expect(mockHistory).toHaveBeenCalledTimes(3);
  expect(mockTxState).toHaveBeenCalledTimes(3);
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
    'failed',
    'waiting',
    'waiting',
  ]);
  expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => result.current.resume());
  expect(result.current.state.phase).toBe('completed');
  expect(mockSend).toHaveBeenCalledTimes(3);
});

it.each([
  { message: 'timeout', code: 'ETIMEDOUT' },
  { code: 40_036, message },
  { ...rejection(), code: 40_005 },
])(
  'keeps an ambiguous response blocked without resending: %j',
  async (error) => {
    mockSend.mockImplementation(async (params) => {
      await params.onBeforeSignAndSend?.();
      throw error;
    });
    const { result } = renderHook(() =>
      useDustSweepSession([], { minRunMs: 0 }),
    );
    await act(async () => result.current.start(snapshot));
    expect(result.current.state.phase).toBe('blocked');
    expect(result.current.state.items.map((item) => item.status)).toEqual([
      'unknown',
      'waiting',
      'waiting',
    ]);
    await act(async () => result.current.resume());
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockHistory).not.toHaveBeenCalled();
  },
);
