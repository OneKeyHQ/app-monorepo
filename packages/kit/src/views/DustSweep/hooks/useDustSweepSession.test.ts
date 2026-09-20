/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IDustSweepSnapshot } from '@onekeyhq/shared/types/swap/dustSweep';

import {
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

it('settles the in-flight item before pausing, then continues only the waiting item', async () => {
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
  act(() => result.current.start(snapshot));
  act(() => result.current.pause());
  expect(result.current.state.phase).toBe('pausing');
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
it('waits for a background signing return on leave and never begins the next item', async () => {
  const first = deferred<IResult>();
  execute.mockImplementationOnce(async ({ onSigning, onBroadcast }) => {
    onSigning();
    const completed = await first.promise;
    onBroadcast('tx-a');
    return completed;
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  act(() => result.current.start(snapshot));
  let leave: Promise<void> | undefined;
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
it('never retries a submission whose broadcast status is unknown', async () => {
  execute.mockImplementationOnce(async ({ onSigning }) => {
    onSigning();
    throw new DustSweepUnknownSubmission();
  });
  const { result } = renderHook(() => useDustSweepSession([]));
  await act(async () => result.current.start(snapshot));
  await act(async () => result.current.resume());
  expect(result.current.state.phase).toBe('paused');
  expect(result.current.state.items[0].status).toBe('unknown');
  expect(execute).toHaveBeenCalledTimes(1);
});
it('returns a canceled password prompt to waiting and allows an explicit retry', async () => {
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
      receivedAmount: '',
      receivedUsd: '',
      successCount: 2,
    }),
  );
});
