import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import {
  reconcileEarnFundingContinuation,
  reserveEarnFundingContinuation,
} from './earnFundingContinuation';
import {
  completeEarnFunding,
  refreshEarnFunding,
  releaseEarnFunding,
  reserveEarnFunding,
  settleEarnFunding,
} from './earnFundingRegistry';

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: jest.fn(),
}));

jest.mock('./earnFundingRegistry', () => ({
  completeEarnFunding: jest.fn(),
  refreshEarnFunding: jest.fn(),
  releaseEarnFunding: jest.fn(),
  reserveEarnFunding: jest.fn(),
  settleEarnFunding: jest.fn(),
}));

const scope = {
  depositKey: 'destination',
  amount: '1.5',
  fundingKey: 'source',
  fundingTxId: 'swap-tx',
  accountId: 'account',
  networkId: 'evm--1',
  accountAddress: '0xaccount',
};

function makeReservation() {
  return {
    markUnknown: jest.fn(async (): Promise<void> => undefined),
    markSubmitted: jest.fn(async (_txId: string): Promise<void> => undefined),
    markFunded: jest.fn(async (_amount: string): Promise<void> => undefined),
    release: jest.fn(async (): Promise<void> => undefined),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(completeEarnFunding).mockResolvedValue(true);
});

it('claims the exact source and retains it after broadcast until chain confirmation', async () => {
  const reservation = makeReservation();
  jest.mocked(reserveEarnFunding).mockReturnValue(reservation);
  const guard = reserveEarnFundingContinuation(scope);
  expect(guard).toBeDefined();
  expect(reserveEarnFunding).toHaveBeenCalledWith('destination', {
    amount: '1.5',
    source: { scope: 'source', txId: 'swap-tx' },
  });
  await guard?.beforeSend();
  expect(reservation.markUnknown).toHaveBeenCalledTimes(1);
  expect(completeEarnFunding).not.toHaveBeenCalled();
  await Promise.all([
    guard?.onAccepted('deposit-tx'),
    guard?.onAccepted('deposit-tx'),
  ]);
  expect(reservation.markSubmitted).toHaveBeenCalledTimes(1);
  expect(reservation.markSubmitted).toHaveBeenCalledWith('deposit-tx');
  expect(completeEarnFunding).not.toHaveBeenCalled();
  expect(reservation.release).not.toHaveBeenCalled();
});

it('waits for an in-flight claim before releasing a safely cancelled attempt', async () => {
  let resolveClaim: (() => void) | undefined;
  const reservation = makeReservation();
  reservation.markUnknown.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveClaim = resolve;
      }),
  );
  jest.mocked(reserveEarnFunding).mockReturnValue(reservation);
  const guard = reserveEarnFundingContinuation(scope);
  if (!guard) throw new OneKeyLocalError('Missing reservation');
  const sending = guard.beforeSend();
  const cancellation = guard.onSafeCancel();
  expect(reservation.release).not.toHaveBeenCalled();
  resolveClaim?.();
  await expect(sending).rejects.toThrow('cancelled');
  await cancellation;
  expect(reservation.release).toHaveBeenCalledTimes(1);
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('does not release an accepted destination while its transaction is being recorded', async () => {
  let resolveSubmitted: (() => void) | undefined;
  const reservation = makeReservation();
  reservation.markSubmitted.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveSubmitted = resolve;
      }),
  );
  jest.mocked(reserveEarnFunding).mockReturnValue(reservation);
  const guard = reserveEarnFundingContinuation(scope);
  if (!guard) throw new OneKeyLocalError('Missing reservation');
  await guard.beforeSend();
  const accepted = guard.onAccepted('deposit-tx');
  await Promise.resolve();
  await guard.onSafeCancel();
  expect(reservation.release).not.toHaveBeenCalled();
  resolveSubmitted?.();
  await accepted;
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('settles and consumes only the exact confirmed destination transaction', async () => {
  jest.mocked(refreshEarnFunding).mockResolvedValue({
    status: 'submitted',
    txId: 'deposit-tx',
    intentAmount: '1.5',
  });
  jest
    .mocked(waitForTxFinalStatus)
    .mockResolvedValue(EOnChainHistoryTxStatus.Success);
  await expect(reconcileEarnFundingContinuation(scope)).resolves.toBe(
    'confirmed',
  );
  expect(waitForTxFinalStatus).toHaveBeenCalledWith({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'deposit-tx',
    expectedAccountAddress: '0xaccount',
  });
  expect(settleEarnFunding).toHaveBeenCalledWith(
    'destination',
    'deposit-tx',
    '1.5',
  );
  expect(completeEarnFunding).toHaveBeenCalledWith('destination', 'deposit-tx');
});

it('releases only a definitively failed destination, retaining the source', async () => {
  jest.mocked(refreshEarnFunding).mockResolvedValue({
    status: 'submitted',
    txId: 'deposit-tx',
    intentAmount: '1.5',
  });
  jest
    .mocked(waitForTxFinalStatus)
    .mockResolvedValue(EOnChainHistoryTxStatus.Failed);
  await expect(reconcileEarnFundingContinuation(scope)).resolves.toBe('failed');
  expect(releaseEarnFunding).toHaveBeenCalledWith('destination', 'deposit-tx');
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('keeps an unresolved transaction locked and rejects a different txid', async () => {
  jest.mocked(refreshEarnFunding).mockResolvedValue({
    status: 'submitted',
    txId: 'deposit-tx',
    intentAmount: '1.5',
  });
  jest.mocked(waitForTxFinalStatus).mockResolvedValue(undefined);
  await expect(reconcileEarnFundingContinuation(scope)).resolves.toBe(
    'pending',
  );
  await expect(
    reconcileEarnFundingContinuation({ ...scope, expectedTxId: 'other' }),
  ).resolves.toBe('pending');
  expect(waitForTxFinalStatus).toHaveBeenCalledTimes(1);
  expect(releaseEarnFunding).not.toHaveBeenCalled();
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('refuses a missing destination txid and keeps the source receipt', async () => {
  const reservation = makeReservation();
  jest.mocked(reserveEarnFunding).mockReturnValue(reservation);
  const guard = reserveEarnFundingContinuation(scope);
  if (!guard) throw new OneKeyLocalError('Missing reservation');
  await guard.beforeSend();
  await expect(guard.onAccepted('  ')).rejects.toThrow(
    'Missing destination transaction ID',
  );
  expect(reservation.release).not.toHaveBeenCalled();
  expect(completeEarnFunding).not.toHaveBeenCalled();
});

it('only releases a not-started operation before its send guard begins', async () => {
  const reservation = makeReservation();
  jest.mocked(reserveEarnFunding).mockReturnValue(reservation);
  const first = reserveEarnFundingContinuation(scope);
  if (!first) throw new OneKeyLocalError('Missing reservation');
  await first.onNotStarted();
  expect(reservation.release).toHaveBeenCalledTimes(1);
  await expect(first.beforeSend()).rejects.toThrow('cancelled');

  const nextReservation = makeReservation();
  jest.mocked(reserveEarnFunding).mockReturnValue(nextReservation);
  const second = reserveEarnFundingContinuation(scope);
  if (!second) throw new OneKeyLocalError('Missing reservation');
  await second.beforeSend();
  await second.onNotStarted();
  expect(nextReservation.release).not.toHaveBeenCalled();
});
