import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { waitForDepositTaskTxStatus } from './waitForDepositTaskTxStatus';

const mockWait = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockHistory = jest.fn<Promise<unknown>, [unknown]>();
const mockXpub = jest.fn<Promise<string | undefined>, []>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccountXpub: () => mockXpub() },
    serviceHistory: {
      getLocalHistoryTxById: (input: unknown) => mockHistory(input),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (input: unknown) => mockWait(input),
}));

const identity = {
  accountId: 'account',
  accountAddress: '0xowner',
  networkId: 'evm--1',
};

beforeEach(() => {
  mockWait.mockReset().mockResolvedValue(undefined);
  mockHistory.mockReset().mockResolvedValue(undefined);
  mockXpub.mockReset().mockResolvedValue(undefined);
});

async function check() {
  return waitForDepositTaskTxStatus({
    identity,
    txid: 'old',
    signal: new AbortController().signal,
  });
}

it('continues only when the speed-up reaches a successful chain status', async () => {
  mockWait
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success);
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'replacement' })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'new' },
      replacedType: EReplaceTxType.SpeedUp,
    });
  await expect(check()).resolves.toBe('success');
  expect(mockWait).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'account',
      networkId: 'evm--1',
      txid: 'new',
    }),
  );
  expect(mockHistory).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: 'account', networkId: 'evm--1' }),
  );
});

it('treats a successful cancel as a failed original step', async () => {
  mockWait
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success);
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'replacement' })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'cancel' },
      replacedType: EReplaceTxType.Cancel,
    });
  await expect(check()).resolves.toBe('failed');
});

it('keeps cancellation semantics when a cancel is itself sped up', async () => {
  mockWait.mockImplementation(async (input) => {
    const params = input as { txid: string };
    return params.txid === 'speedup-tx'
      ? EOnChainHistoryTxStatus.Success
      : undefined;
  });
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'cancel' })
    .mockResolvedValueOnce({
      replacedNextId: 'speedup',
      decodedTx: { txid: 'cancel-tx' },
      replacedType: EReplaceTxType.Cancel,
    })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'speedup-tx' },
      replacedType: EReplaceTxType.SpeedUp,
    });
  await expect(check()).resolves.toBe('failed');
  expect(mockWait).toHaveBeenCalledWith(
    expect.objectContaining({ txid: 'speedup-tx' }),
  );
});

it.each([
  [EReplaceTxType.SpeedUp, 'success'],
  [EReplaceTxType.Cancel, 'failed'],
] as const)(
  'reconciles the intermediate %s when it is mined before the later replacement',
  async (replacedType, expected) => {
    mockWait.mockImplementation(async (input) => {
      const params = input as { txid: string };
      return params.txid === 'middle-tx'
        ? EOnChainHistoryTxStatus.Success
        : undefined;
    });
    mockHistory
      .mockResolvedValueOnce({ replacedNextId: 'middle' })
      .mockResolvedValueOnce({
        decodedTx: { txid: 'middle-tx' },
        replacedNextId: 'last',
        replacedType,
      })
      .mockResolvedValueOnce({
        decodedTx: { txid: 'last-tx' },
        replacedType: EReplaceTxType.SpeedUp,
      });
    await expect(check()).resolves.toBe(expected);
    expect(mockWait).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'middle-tx' }),
    );
    expect(mockWait).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'last-tx' }),
    );
  },
);

it('keeps inconsistent terminal results unknown', async () => {
  mockWait.mockImplementation(async (input) => {
    const params = input as { txid: string };
    return params.txid === 'old' ? undefined : EOnChainHistoryTxStatus.Success;
  });
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'speedup' })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'speedup' },
      replacedNextId: 'cancel',
      replacedType: EReplaceTxType.SpeedUp,
    })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'cancel' },
      replacedType: EReplaceTxType.Cancel,
    });
  await expect(check()).resolves.toBe('unknown');
});

it('does not treat a query error as a failed transaction or block another result', async () => {
  mockWait.mockImplementation(async (input) => {
    const params = input as { txid: string };
    if (params.txid === 'old') throw new OneKeyLocalError('query failed');
    return EOnChainHistoryTxStatus.Success;
  });
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'replacement' })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'new' },
      replacedType: EReplaceTxType.SpeedUp,
    });
  await expect(check()).resolves.toBe('success');
});

it('does not query transaction status after cancellation during history lookup', async () => {
  const controller = new AbortController();
  let finishHistory: ((value: unknown) => void) | undefined;
  let notifyHistory: (() => void) | undefined;
  const historyStarted = new Promise<void>((resolve) => {
    notifyHistory = resolve;
  });
  mockHistory.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishHistory = resolve;
        notifyHistory?.();
      }),
  );
  const result = waitForDepositTaskTxStatus({
    identity,
    txid: 'old',
    signal: controller.signal,
  });
  await historyStarted;
  controller.abort();
  finishHistory?.({ replacedNextId: 'replacement' });
  await expect(result).resolves.toBe('unknown');
  expect(mockWait).toHaveBeenCalledTimes(1);
  expect(mockWait).toHaveBeenCalledWith(
    expect.objectContaining({ txid: 'old' }),
  );
});

it('keeps an unconfirmed replacement unknown', async () => {
  mockWait.mockResolvedValue(undefined);
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'replacement' })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'new' },
      replacedType: EReplaceTxType.SpeedUp,
    });
  await expect(check()).resolves.toBe('unknown');
});

it('allows a failed replacement to end the original step', async () => {
  mockWait
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(EOnChainHistoryTxStatus.Failed);
  mockHistory
    .mockResolvedValueOnce({ replacedNextId: 'replacement' })
    .mockResolvedValueOnce({
      decodedTx: { txid: 'new' },
      replacedType: EReplaceTxType.SpeedUp,
    });
  await expect(check()).resolves.toBe('failed');
});

it('continues checking the original when local replacement history is unavailable', async () => {
  mockWait
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success);
  mockHistory.mockRejectedValueOnce(new Error('local history unavailable'));
  await expect(check()).resolves.toBe('success');
  expect(mockWait).toHaveBeenLastCalledWith(
    expect.objectContaining({ txid: 'old' }),
  );
});

it('keeps malformed and cyclic replacement chains unknown', async () => {
  mockWait.mockResolvedValue(undefined);
  mockHistory.mockResolvedValue({ replacedNextId: 'replacement' });
  await expect(check()).resolves.toBe('unknown');
  expect(mockHistory).toHaveBeenCalledTimes(2);
  expect(mockWait).toHaveBeenCalledTimes(2);
});

it('checks each transaction at most once when maxAttempts is one', async () => {
  mockWait.mockResolvedValue(undefined);
  mockHistory.mockResolvedValue(undefined);
  await expect(
    waitForDepositTaskTxStatus({
      identity,
      txid: 'old',
      signal: new AbortController().signal,
      maxAttempts: 1,
    }),
  ).resolves.toBe('unknown');
  expect(mockWait).toHaveBeenCalledTimes(1);
  expect(mockWait).toHaveBeenCalledWith(
    expect.objectContaining({ maxAttempts: 1 }),
  );
});

it('preserves the original result when it is already final', async () => {
  mockWait.mockResolvedValue(EOnChainHistoryTxStatus.Success);
  await expect(check()).resolves.toBe('success');
});
