/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IDustSweepSnapshot } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  DustSweepPaused,
  DustSweepRetryableError,
  DustSweepUnknownSubmission,
  DustSweepUserCanceled,
  executeDustSweepItem,
} from '../utils/execution';

import { useDustSweepSession } from './useDustSweepSession';

jest.mock('@onekeyhq/kit/src/views/Swap/hooks/useSwapTxHistory', () => ({
  generateSwapHistoryItemForContext: jest.fn(),
}));
const mockResultLog = jest.fn();
const mockItemLog = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      dustSweep: {
        dustSweepResult: (params: unknown) => {
          mockResultLog(params);
        },
        dustSweepStart: jest.fn(),
        dustSweepPageVisited: jest.fn(),
        dustSweepItemResult: (params: unknown) => {
          mockItemLog(params);
        },
      },
    },
  },
}));
jest.mock('../utils/execution', () => ({
  executeDustSweepItem: jest.fn(),
  DustSweepUnknownSubmission: jest.fn(),
  DustSweepUserCanceled: jest.fn(),
  DustSweepRetryableError: jest.fn(),
  DustSweepPaused: jest.fn(),
}));
jest.mock('../utils/quote', () => ({ DustSweepSkip: jest.fn() }));

const snapshot: IDustSweepSnapshot = {
  id: 'session',
  accountId: 'account',
  address: 'address',
  networkId: 'evm--1',
  slippage: 5,
  nativeToken: {
    networkId: 'evm--1',
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
    price: '2000',
  },
  tokens: ['a', 'b'].map((key) => ({
    key,
    networkId: 'evm--1',
    contractAddress: key,
    symbol: key,
    decimals: 6,
    amount: '1',
    valueUsd: '1',
    suspicious: false,
  })),
};
const execute = jest.mocked(executeDustSweepItem);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type IResult = Awaited<ReturnType<typeof executeDustSweepItem>>;
const success: IResult = {
  status: 'success',
  receivedAmount: '0.01',
  receiptUnavailable: false,
};

beforeEach(() => jest.clearAllMocks());

it('pauses immediately while retaining the broadcast worker and its eventual result', async () => {
  const first = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx-a');
    return first.promise;
  });
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx-b');
    return success;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  act(() => result.current.pause());
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items[0]).toMatchObject({
    status: 'broadcasted',
    txId: 'tx-a',
  });
  expect(execute.mock.calls[0][0].signal.aborted).toBe(false);
  expect(execute).toHaveBeenCalledTimes(1);
  await act(async () => {
    first.resolve(success);
  });
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items.map((item) => item.status)).toEqual([
    'success',
    'waiting',
  ]);
  expect(mockResultLog).not.toHaveBeenCalled();
  await act(async () => result.current.resume());
  expect(result.current.state.phase).toBe('completed');
  expect(execute).toHaveBeenCalledTimes(2);
  expect(mockResultLog).toHaveBeenCalledTimes(1);
});

it('does not duplicate an active broadcast when resuming before it settles', async () => {
  const first = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx-a');
    return first.promise;
  });
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx-b');
    return success;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  act(() => {
    result.current.pause();
    result.current.resume();
    result.current.pause();
    result.current.resume();
  });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(result.current.state.items[0].txId).toBe('tx-a');
  await act(async () => first.resolve(success));
  expect(execute).toHaveBeenCalledTimes(2);
  expect(result.current.state.phase).toBe('completed');
});

it('invalidates old preparation even after a quick stop and resume', async () => {
  const preparation = deferred<void>();
  const signed = jest.fn();
  execute.mockImplementationOnce(async ({ shouldContinue }) => {
    await preparation.promise;
    if (!shouldContinue?.()) throw new DustSweepPaused();
    signed();
    return success;
  });
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('fresh-tx');
    return success;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start({ ...snapshot, tokens: [snapshot.tokens[0]] });
  });
  act(() => {
    result.current.pause();
    result.current.resume();
  });
  await act(async () => preparation.resolve());
  expect(signed).not.toHaveBeenCalled();
  expect(execute).toHaveBeenCalledTimes(2);
  expect(result.current.state.phase).toBe('completed');
  expect(result.current.state.items[0].txId).toBe('fresh-tx');
});

it('preserves a late broadcast from signing after stop without starting the next item', async () => {
  const signature = deferred<void>();
  const settled = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    await signature.promise;
    onBroadcast('late-tx');
    return settled.promise;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  act(() => result.current.pause());
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items[0].status).toBe('signing');
  await act(async () => signature.resolve());
  expect(result.current.state.items[0]).toMatchObject({
    status: 'broadcasted',
    txId: 'late-tx',
  });
  await act(async () => settled.resolve(success));
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items[1].status).toBe('waiting');
  expect(execute).toHaveBeenCalledTimes(1);
});

it('blocks an uncertain SDK result after stopping instead of retrying the item', async () => {
  const signature = deferred<void>();
  execute.mockImplementationOnce(async ({ onSigning }) => {
    onSigning();
    await signature.promise;
    throw new DustSweepUnknownSubmission();
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  act(() => result.current.pause());
  await act(async () => signature.resolve());
  expect(result.current.state.phase).toBe('blocked');
  expect(result.current.state.items[0].status).toBe('unknown');
  act(() => result.current.resume());
  expect(execute).toHaveBeenCalledTimes(1);
});
it('waits for a background signing return on leave and never begins the next item', async () => {
  const first = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    const completed = await first.promise;
    onBroadcast('tx-a');
    return completed;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  let leave: Promise<boolean> | undefined;
  act(() => {
    leave = result.current.leave();
  });
  expect(result.current.leaving).toBe(true);
  expect(execute.mock.calls[0][0].signal.aborted).toBe(true);
  await act(async () => {
    first.resolve(success);
    await leave;
  });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(result.current.state.items[1].status).toBe('waiting');
  expect(mockResultLog).toHaveBeenCalledWith(
    expect.objectContaining({ endReason: 'left' }),
  );
});

it('reports leaving separately from stopping after a paused session', async () => {
  const first = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx-a');
    return first.promise;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  act(() => result.current.pause());
  await act(async () => {
    first.resolve(success);
    await first.promise;
  });
  expect(result.current.state.phase).toBe('paused');

  await act(async () => result.current.leave());
  expect(mockResultLog).toHaveBeenCalledWith(
    expect.objectContaining({ endReason: 'left' }),
  );
});
it('never retries a submission whose broadcast status is unknown', async () => {
  execute.mockImplementationOnce(async ({ onSigning }) => {
    onSigning();
    throw new DustSweepUnknownSubmission();
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  await act(async () => result.current.start(snapshot));
  await act(async () => result.current.resume());
  expect(result.current.state.phase).toBe('blocked');
  expect(result.current.state.items[0].status).toBe('unknown');
  expect(execute).toHaveBeenCalledTimes(1);
});
it('pauses a canceled password prompt with its item waiting for explicit retry', async () => {
  execute.mockImplementationOnce(async ({ onSigning, onPrepared }) => {
    onSigning();
    onPrepared();
    throw new DustSweepUserCanceled();
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items[0].status).toBe('waiting');
  expect(mockItemLog).not.toHaveBeenCalled();
});
it('does not report a partial receipt as the complete amount', async () => {
  execute.mockImplementation(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx');
    return { status: 'success', receiptUnavailable: true };
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('completed');
  expect(mockResultLog).toHaveBeenCalledWith(
    expect.objectContaining({
      receiptAvailable: false,
      successCount: 2,
    }),
  );
});

it('pauses a retryable preparation failure with approval identity intact', async () => {
  execute.mockImplementationOnce(
    async ({ onSigning, onApprovalBroadcast, onPrepared }) => {
      onSigning();
      onApprovalBroadcast?.(['approval-known']);
      onPrepared();
      throw new DustSweepRetryableError('History failed');
    },
  );
  const { result } = renderHook(() => useDustSweepSession([]));
  await act(async () => result.current.start(snapshot));
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items[0]).toMatchObject({
    status: 'waiting',
    approvalTxIds: ['approval-known'],
  });
});

it('skips unavailable preview rows without entering the executor and rejects duplicate starts', async () => {
  execute.mockImplementation(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('tx');
    return success;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  let acceptedId: string | undefined;
  let duplicateId: string | undefined;
  await act(async () => {
    acceptedId = result.current.start(snapshot, { b: 'noQuote' });
    duplicateId = result.current.start(snapshot);
  });
  expect(acceptedId).toBe(result.current.state.snapshot?.id);
  expect(acceptedId).toBeTruthy();
  expect(duplicateId).toBeUndefined();
  expect(execute).toHaveBeenCalledTimes(1);
  expect(result.current.state.phase).toBe('completed');
  expect(result.current.state.items[1]).toMatchObject({
    status: 'skipped',
    reason: 'noQuote',
  });
});

it('isolates late callbacks even when a later run uses the same caller id', async () => {
  let oldBroadcast: ((txId: string) => void) | undefined;
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    oldBroadcast = onBroadcast;
    onSigning();
    onBroadcast('first');
    return success;
  });
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    onBroadcast('second');
    return success;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  const single = { ...snapshot, tokens: [snapshot.tokens[0]] };
  await act(async () => result.current.start(single));
  const firstId = result.current.state.snapshot?.id;
  act(() => result.current.reset());
  await act(async () => result.current.start(single));
  expect(result.current.state.snapshot?.id).not.toBe(firstId);
  act(() => oldBroadcast?.('obsolete'));
  expect(result.current.state.items[0].txId).toBe('second');
});

it('retains a submission that becomes unknown while leaving before allowing a second explicit leave', async () => {
  const settle = deferred<void>();
  execute.mockImplementationOnce(async ({ onSigning }) => {
    onSigning();
    await settle.promise;
    throw new DustSweepUnknownSubmission();
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => {
    result.current.start(snapshot);
  });
  let left: boolean | undefined;
  await act(async () => {
    const leaving = result.current.leave();
    settle.resolve();
    left = await leaving;
  });
  expect(left).toBe(false);
  expect(result.current.state.phase).toBe('blocked');
  expect(result.current.state.items[0].status).toBe('unknown');
  act(() => result.current.resume());
  expect(execute).toHaveBeenCalledTimes(1);
  await act(async () => {
    left = await result.current.leave();
  });
  expect(left).toBe(true);
  expect(result.current.state.phase).toBe('left');
});
