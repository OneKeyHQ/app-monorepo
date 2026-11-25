/* eslint-disable import/first */

const mockRead = jest.fn<Promise<unknown>, [string]>();
const mockChange = jest.fn<
  Promise<unknown>,
  [string, { type: string; attemptId: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnFunding: (scope: string) => mockRead(scope),
      changeEarnFunding: (
        scope: string,
        change: { type: string; attemptId: string },
      ) => mockChange(scope, change),
    },
  },
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getEarnFunding,
  refreshEarnFunding,
  reserveEarnFunding,
} from './earnFundingRegistry';

beforeEach(() => {
  mockRead.mockReset();
  mockChange.mockReset();
});

it('retries an explicitly safe cancellation on refresh after a storage error', async () => {
  const scope = 'retry-safe-cancel';
  let funding: { status: 'unknown' } | null = null;
  let attemptId = '';
  mockRead.mockImplementation(async () => funding);
  mockChange.mockImplementation(
    async (_scope: string, change: { type: string; attemptId: string }) => {
      if (change.type === 'claim') {
        attemptId = change.attemptId;
        funding = { status: 'unknown' };
        return { applied: true, funding };
      }
      expect(change.attemptId).toBe(attemptId);
      if (
        mockChange.mock.calls.filter((call) => call[1].type === 'cancelled')
          .length === 1
      )
        throw new OneKeyLocalError('storage unavailable');
      funding = null;
      return { applied: true, funding };
    },
  );
  const reservation = reserveEarnFunding(scope);
  if (!reservation) throw new OneKeyLocalError('Missing reservation');
  await reservation.markUnknown();
  await expect(reservation.release({ retrySafeCancel: true })).rejects.toThrow(
    'storage unavailable',
  );
  expect(getEarnFunding(scope)?.status).toBe('unknown');
  await Promise.all([refreshEarnFunding(scope), refreshEarnFunding(scope)]);
  expect(getEarnFunding(scope)).toBeUndefined();
  expect(reserveEarnFunding(scope)).toBeDefined();
  expect(
    mockChange.mock.calls.filter((call) => call[1].type === 'cancelled'),
  ).toHaveLength(2);
});

it('keeps an attempt locked when a safe cancellation conflicts with persisted funding', async () => {
  const scope = 'conflicting-safe-cancel';
  const funding = { status: 'unknown' };
  mockRead.mockResolvedValue(funding);
  mockChange.mockImplementation(
    async (_scope: string, change: { type: string }) =>
      change.type === 'claim'
        ? { applied: true, funding }
        : { applied: false, funding },
  );
  const reservation = reserveEarnFunding(scope);
  if (!reservation) throw new OneKeyLocalError('Missing reservation');
  await reservation.markUnknown();
  await expect(reservation.release({ retrySafeCancel: true })).rejects.toThrow(
    'Unable to release',
  );
  await expect(refreshEarnFunding(scope)).resolves.toEqual(funding);
  expect(getEarnFunding(scope)?.status).toBe('unknown');
  expect(reserveEarnFunding(scope)).toBeUndefined();
  expect(mockChange).toHaveBeenCalledTimes(2);
});

it('exposes a submitted transaction when safe cancellation conflicts', async () => {
  const scope = 'submitted-safe-cancel';
  const pending = { status: 'unknown' };
  const submitted = { status: 'submitted', txId: 'accepted-tx' };
  mockRead.mockResolvedValue(submitted);
  mockChange.mockImplementation(
    async (_scope: string, change: { type: string }) =>
      change.type === 'claim'
        ? { applied: true, funding: pending }
        : { applied: false, funding: submitted },
  );
  const reservation = reserveEarnFunding(scope);
  if (!reservation) throw new OneKeyLocalError('Missing reservation');
  await reservation.markUnknown();
  await expect(reservation.release({ retrySafeCancel: true })).rejects.toThrow(
    'Unable to release',
  );
  await expect(refreshEarnFunding(scope)).resolves.toEqual(submitted);
  expect(getEarnFunding(scope)).toEqual(submitted);
  expect(reserveEarnFunding(scope)).toBeUndefined();
});

it('treats an already absent record as a completed safe cancellation', async () => {
  const scope = 'already-cancelled';
  mockChange.mockResolvedValue({ applied: false, funding: null });
  const reservation = reserveEarnFunding(scope);
  if (!reservation) throw new OneKeyLocalError('Missing reservation');
  await reservation.release({ retrySafeCancel: true });
  expect(reserveEarnFunding(scope)).toBeDefined();
});

it('recovers when cancellation persisted but its response was lost', async () => {
  const scope = 'lost-cancel-response';
  const pending = { status: 'unknown' };
  mockRead.mockResolvedValue(null);
  mockChange
    .mockResolvedValueOnce({ applied: true, funding: pending })
    .mockRejectedValueOnce(new Error('response lost'))
    .mockResolvedValueOnce({ applied: false, funding: null });
  const reservation = reserveEarnFunding(scope);
  if (!reservation) throw new OneKeyLocalError('Missing reservation');
  await reservation.markUnknown();
  await expect(reservation.release({ retrySafeCancel: true })).rejects.toThrow(
    'response lost',
  );
  await expect(refreshEarnFunding(scope)).resolves.toBeUndefined();
  expect(reserveEarnFunding(scope)).toBeDefined();
});

it('publishes the fresh read after retrying a safe cancellation', async () => {
  const scope = 'refresh-after-cancel';
  const pending = { status: 'unknown' };
  const replacement = { status: 'submitted', txId: 'new-transaction' };
  mockRead.mockResolvedValue(replacement);
  mockChange
    .mockResolvedValueOnce({ applied: true, funding: pending })
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce({ applied: true, funding: null });
  const reservation = reserveEarnFunding(scope);
  if (!reservation) throw new OneKeyLocalError('Missing reservation');
  await reservation.markUnknown();
  await expect(reservation.release({ retrySafeCancel: true })).rejects.toThrow(
    'storage unavailable',
  );
  await expect(refreshEarnFunding(scope)).resolves.toEqual(replacement);
  expect(getEarnFunding(scope)).toEqual(replacement);
});
