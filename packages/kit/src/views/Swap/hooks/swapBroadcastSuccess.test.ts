/* eslint-disable import/first */

const mockLogError = jest.fn<void, [string]>();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (message: string) => {
          mockLogError(message);
        },
      },
    },
  },
}));

import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

import {
  completeBroadcastedSwapSuccess,
  completeSignedNoSendSwapSuccess,
} from './swapBroadcastSuccess';

const swapInfo = {} as ISwapTxInfo;

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const flushUnhandledRejections = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

describe('Swap broadcast success effects', () => {
  beforeEach(() => {
    mockLogError.mockClear();
  });

  it('notifies without waiting for pending history persistence', async () => {
    const deferredHistory = createDeferred();
    const onSwapBroadcast = jest.fn().mockResolvedValue(undefined);
    let historySettled = false;
    const generateSwapHistoryItem = jest.fn(async () => {
      await deferredHistory.promise;
      historySettled = true;
    });

    const completion = completeBroadcastedSwapSuccess({
      txId: 'tx-id',
      swapInfo,
      generateSwapHistoryItem,
      onSwapBroadcast,
    });
    await Promise.resolve();

    expect(generateSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
    expect(historySettled).toBe(false);

    deferredHistory.resolve();
    await expect(completion).resolves.toBeUndefined();
    expect(historySettled).toBe(true);
  });

  it('notifies once and consumes a broadcast history rejection', async () => {
    const deferredBroadcast = createDeferred();
    const onSwapBroadcast = jest.fn(() => deferredBroadcast.promise);
    const historyError = new Error('history unavailable');
    const generateSwapHistoryItem = jest.fn().mockRejectedValue(historyError);
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);

    try {
      const completion = completeBroadcastedSwapSuccess({
        txId: 'tx-id',
        swapInfo,
        gasFeeFiatValue: '1.23',
        gasFeeInNative: '0.01',
        generateSwapHistoryItem,
        onSwapBroadcast,
      });
      await flushUnhandledRejections();
      deferredBroadcast.resolve();
      await expect(completion).resolves.toBeUndefined();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }

    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
    expect(generateSwapHistoryItem).toHaveBeenCalledWith({
      txId: 'tx-id',
      swapTxInfo: swapInfo,
      gasFeeFiatValue: '1.23',
      gasFeeInNative: '0.01',
    });
    expect(generateSwapHistoryItem.mock.invocationCallOrder[0]).toBeLessThan(
      onSwapBroadcast.mock.invocationCallOrder[0],
    );
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('history unavailable'),
    );
    expect(unhandledRejection).not.toHaveBeenCalled();
  });

  it('notifies once and consumes a signed-no-send history rejection', async () => {
    const onSwapBroadcast = jest.fn().mockResolvedValue(undefined);
    const generateSwapHistoryItem = jest
      .fn()
      .mockRejectedValue(new Error('signed history unavailable'));
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);

    try {
      await expect(
        completeSignedNoSendSwapSuccess({
          swapInfo,
          generateSwapHistoryItem,
          onSwapBroadcast,
        }),
      ).resolves.toBeUndefined();
      await flushUnhandledRejections();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }

    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
    expect(generateSwapHistoryItem).toHaveBeenCalledWith({
      swapTxInfo: swapInfo,
    });
    expect(generateSwapHistoryItem.mock.invocationCallOrder[0]).toBeLessThan(
      onSwapBroadcast.mock.invocationCallOrder[0],
    );
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('signed history unavailable'),
    );
    expect(unhandledRejection).not.toHaveBeenCalled();
  });

  it('flags a handoff that resolved without reaching storage', async () => {
    // The service resolves rather than throws here on purpose — the tx is
    // already broadcast. That makes the flag the only way this is visible.
    const generateSwapHistoryItem = jest
      .fn()
      .mockResolvedValue({ durable: false });

    await completeBroadcastedSwapSuccess({
      txId: 'tx-id',
      swapInfo,
      generateSwapHistoryItem,
      onSwapBroadcast: jest.fn().mockResolvedValue(undefined),
    });

    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('not persisted durably'),
    );
  });

  it('stays quiet when the handoff reached storage', async () => {
    const generateSwapHistoryItem = jest
      .fn()
      .mockResolvedValue({ durable: true });

    await completeBroadcastedSwapSuccess({
      txId: 'tx-id',
      swapInfo,
      generateSwapHistoryItem,
      onSwapBroadcast: jest.fn().mockResolvedValue(undefined),
    });

    expect(mockLogError).not.toHaveBeenCalled();
  });
});
