/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  ESwapTxHistoryStatus,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { fetchAccountTransactionMarks } from '../../utils/accountTransactionMarks';

import { fetchLocalAccountTransactionMarks } from './localAccountTransactionMarks';
import { useTradingViewNativeAccountMarks } from './useTradingViewNativeAccountMarks';

import type { IAccountTransactionMark } from '../../utils/accountTransactionMarks';
import type { ITradingViewNativeTradeMark } from '../types';

jest.mock('../../utils/accountTransactionMarks', () => ({
  fetchAccountTransactionMarks: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return {
    appEventBus: new EventEmitter(),
    EAppEventBusNames: {
      SwapTxHistoryStatusUpdate: 'SwapTxHistoryStatusUpdate',
    },
  };
});

jest.mock('./localAccountTransactionMarks', () => ({
  ...jest.requireActual<typeof import('./localAccountTransactionMarks')>(
    './localAccountTransactionMarks',
  ),
  fetchLocalAccountTransactionMarks: jest.fn(),
}));

const fetchLocalMarks = jest.mocked(fetchLocalAccountTransactionMarks);
const fetchMarks = jest.mocked(fetchAccountTransactionMarks);
const context = {
  accountAddress: 'test-account',
  networkId: 'sol--101',
  tokenAddress: 'CaseSensitiveToken',
};
const params = { context, from: 1000, to: 2000 };
const buyMark = {
  id: 'test-buy',
  transactionHash: 'test-transaction',
  label: 'B',
  time: 1500,
  text: 'Buy TOKEN',
  color: '#0A7AFF',
} as const;
const sellMark = { ...buyMark, id: 'test-sell', label: 'S' } as const;
const token: ISwapToken = {
  networkId: context.networkId,
  contractAddress: context.tokenAddress,
  symbol: 'TOKEN',
  decimals: 9,
};

async function flushRequests() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useTradingViewNativeAccountMarks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_800_000);
    fetchMarks.mockReset();
    fetchLocalMarks.mockReset();
    fetchLocalMarks.mockResolvedValue([]);
    fetchMarks.mockResolvedValue([buyMark]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads marks for the loaded candles and includes the live candle', async () => {
    const { result } = renderHook(() =>
      useTradingViewNativeAccountMarks(params),
    );
    await flushRequests();

    expect(fetchMarks).toHaveBeenCalledWith({
      ...context,
      from: 1000,
      to: 2000,
    });
    expect(result.current).toEqual([
      {
        id: 'system.accountTradeMarks',
        type: 'tradeMarks',
        props: { marks: [buyMark] },
      },
    ]);
  });

  it('publishes a locally confirmed trade while the server request is still pending, then reconciles it', async () => {
    let resolveServer: ((marks: IAccountTransactionMark[]) => void) | undefined;
    fetchMarks.mockResolvedValueOnce([]);
    const { result } = renderHook(() =>
      useTradingViewNativeAccountMarks(params),
    );
    await flushRequests();
    fetchLocalMarks.mockResolvedValueOnce([buyMark]);
    fetchMarks.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveServer = resolve;
        }),
    );
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    await flushRequests();
    expect(result.current[0].props.marks).toEqual([buyMark]);
    const indexedMark = { ...buyMark, id: 'server-buy', time: 1501 };
    await act(async () => {
      resolveServer?.([indexedMark]);
    });
    expect(result.current[0].props.marks).toEqual([indexedMark]);
  });

  it('keeps retrying after the K-line range changes and retains local marks when the index is empty', async () => {
    fetchMarks.mockResolvedValue([]);
    const { result, rerender } = renderHook(useTradingViewNativeAccountMarks, {
      initialProps: params,
    });
    await flushRequests();
    fetchLocalMarks.mockResolvedValue([buyMark]);
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    await flushRequests();
    rerender({ ...params, to: 2060 });
    await flushRequests();
    const callCount = fetchMarks.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchMarks).toHaveBeenCalledTimes(callCount + 1);
    expect(fetchMarks).toHaveBeenLastCalledWith({
      ...context,
      from: 1000,
      to: 2060,
    });
    expect(result.current[0].props.marks).toEqual([buyMark]);
  });

  it('does not fetch without an account, token context, or loaded candles', () => {
    const { result, rerender } = renderHook(useTradingViewNativeAccountMarks, {
      initialProps: { ...params, context: undefined } as Parameters<
        typeof useTradingViewNativeAccountMarks
      >[0],
    });
    rerender({ ...params, context: { ...context, accountAddress: undefined } });
    rerender({ ...params, from: undefined, to: undefined });
    expect(fetchMarks).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('clears old marks and ignores responses from the previous account or token', async () => {
    let resolveOldRequest:
      | ((marks: IAccountTransactionMark[]) => void)
      | undefined;
    const { result, rerender } = renderHook(useTradingViewNativeAccountMarks, {
      initialProps: params,
    });
    await flushRequests();
    fetchMarks.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldRequest = resolve;
        }),
    );
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    fetchMarks.mockResolvedValueOnce([]);
    rerender({
      ...params,
      context: { ...context, accountAddress: 'other-account' },
    });
    expect(result.current).toEqual([]);
    await flushRequests();
    await act(async () => {
      resolveOldRequest?.([buyMark]);
    });
    expect(result.current).toEqual([]);

    fetchMarks.mockResolvedValueOnce([sellMark]);
    rerender({
      ...params,
      context: { ...context, tokenAddress: 'OtherToken' },
    });
    expect(result.current).toEqual([]);
    await flushRequests();
    expect(result.current[0].props.marks).toEqual([sellMark]);
  });

  it('keeps historical requests inside the loaded candles during swap retries', async () => {
    jest.setSystemTime(4_000_000);
    const { result } = renderHook(() =>
      useTradingViewNativeAccountMarks(params),
    );
    await flushRequests();
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    await flushRequests();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    for (const fetch of [fetchMarks, fetchLocalMarks]) {
      expect(fetch).toHaveBeenCalledTimes(5);
      expect(fetch.mock.calls.map(([request]) => request)).toEqual(
        Array.from({ length: 5 }, () => ({
          ...context,
          from: params.from,
          to: params.to,
        })),
      );
    }
    expect(result.current[0].props.marks).toEqual([buyMark]);
  });

  it('keeps historical local marks when a failed refresh retains 60 newer indexed fills', async () => {
    const newerMarks = Array.from({ length: 60 }, (_, index) => ({
      ...buyMark,
      id: `newer-${index}`,
      transactionHash: `newer-transaction-${index}`,
      time: 3000 + index,
    }));
    fetchMarks.mockResolvedValueOnce(newerMarks);
    const { result, rerender } = renderHook(useTradingViewNativeAccountMarks, {
      initialProps: { ...params, to: 4000 },
    });
    await flushRequests();
    expect(result.current[0].props.marks).toHaveLength(60);

    fetchMarks.mockRejectedValueOnce(new Error('Unavailable'));
    fetchLocalMarks.mockResolvedValueOnce([buyMark]);
    rerender(params);
    expect(result.current).toEqual([]);
    await flushRequests();
    expect(result.current[0].props.marks).toEqual([buyMark]);
  });

  it('refreshes after buys and sells and retries index lag within the loaded range', async () => {
    fetchMarks.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { result, unmount } = renderHook(() =>
      useTradingViewNativeAccountMarks(params),
    );
    await flushRequests();
    jest.setSystemTime(2_100_000);
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    await flushRequests();
    expect(fetchMarks).toHaveBeenLastCalledWith({
      ...context,
      from: 1000,
      to: 2000,
    });
    expect(result.current).toEqual([]);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current[0].props.marks).toEqual([buyMark]);

    fetchMarks.mockResolvedValue([buyMark, sellMark]);
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.PARTIALLY_FILLED,
        fromToken: token,
      });
    });
    await flushRequests();
    expect(result.current[0].props.marks).toEqual([buyMark, sellMark]);
    const callCount = fetchMarks.mock.calls.length;
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(fetchMarks).toHaveBeenCalledTimes(callCount);
    expect(
      appEventBus.listenerCount(EAppEventBusNames.SwapTxHistoryStatusUpdate),
    ).toBe(0);
  });

  it('ignores unrelated transactions and preserves Solana address case', async () => {
    renderHook(() => useTradingViewNativeAccountMarks(params));
    await flushRequests();
    for (const toToken of [
      { ...token, contractAddress: context.tokenAddress.toLowerCase() },
      { ...token, networkId: 'evm--1' },
    ]) {
      act(() => {
        appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
          status: ESwapTxHistoryStatus.SUCCESS,
          toToken,
        });
      });
    }
    expect(fetchMarks).toHaveBeenCalledTimes(1);
  });

  it('matches checksum EVM token addresses', async () => {
    renderHook(() =>
      useTradingViewNativeAccountMarks({
        ...params,
        context: { ...context, networkId: 'evm--1', tokenAddress: '0xAbC' },
      }),
    );
    await flushRequests();
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: { ...token, networkId: 'evm--1', contractAddress: '0xabc' },
      });
    });
    await flushRequests();
    expect(fetchMarks).toHaveBeenCalledTimes(2);
  });

  it('ignores an older response when refreshes complete out of order', async () => {
    let resolveInitialRequest:
      | ((marks: IAccountTransactionMark[]) => void)
      | undefined;
    fetchMarks.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitialRequest = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useTradingViewNativeAccountMarks(params),
    );
    fetchMarks.mockResolvedValueOnce([sellMark]);
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    await flushRequests();
    await act(async () => {
      resolveInitialRequest?.([buyMark]);
    });
    expect(result.current[0].props.marks).toEqual([sellMark]);
  });

  it('reloads marks when older candles load and retains marks on a failed refresh', async () => {
    const { result, rerender } = renderHook(useTradingViewNativeAccountMarks, {
      initialProps: params,
    });
    await flushRequests();
    rerender({ ...params, from: 500 });
    await flushRequests();
    expect(fetchMarks).toHaveBeenLastCalledWith({
      ...context,
      from: 500,
      to: 2000,
    });
    fetchMarks.mockRejectedValueOnce(new Error('Unavailable'));
    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
        toToken: token,
      });
    });
    await flushRequests();
    expect(result.current[0].props.marks).toEqual<
      ITradingViewNativeTradeMark[]
    >([buyMark]);
  });

  it('clears indexed marks after a successful empty refresh', async () => {
    const { result, rerender } = renderHook(useTradingViewNativeAccountMarks, {
      initialProps: params,
    });
    await flushRequests();
    expect(result.current[0].props.marks).toEqual([buyMark]);
    fetchMarks.mockResolvedValueOnce([]);
    rerender({ ...params, from: 500 });
    await flushRequests();
    expect(result.current).toEqual([]);
  });
});
