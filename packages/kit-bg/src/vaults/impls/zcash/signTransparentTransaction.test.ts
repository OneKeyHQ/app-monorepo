import type { IZcashTransparentTxRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

import { signTransparentTransaction } from './signTransparentTransaction';

import type { IEncodedTxZcash } from './types';

const outpoints = [
  { txid: 'public-tx-a', vout: 0 },
  { txid: 'public-tx-b', vout: 1 },
];
const request = {
  selectedOutpoints: outpoints,
  targetHeight: 100,
  expiryHeight: 120,
} as IZcashTransparentTxRequest;
const encodedTx = {
  fee: '10000',
  zcashTransparentPlan: { ownerId: 'owner' },
} as IEncodedTxZcash;
const result = {
  txid: 'signed-public-tx',
  rawTx: 'synthetic-transaction',
  feeZat: '10000',
  expiryHeight: 120,
  spentOutpoints: outpoints,
};
function setup() {
  const journal = {
    reserveTransparentOutpoints: jest.fn().mockResolvedValue(undefined),
    saveTransparentPendingTx: jest.fn().mockResolvedValue(undefined),
    releaseTransparentReservation: jest.fn().mockResolvedValue(undefined),
  };
  return { journal, sign: jest.fn().mockResolvedValue(result) };
}

it('retains reservations for signed transactions until broadcast resolution', async () => {
  const { journal, sign } = setup();
  const signed = await signTransparentTransaction({
    journal,
    sign,
    accountId: 'account',
    encodedTx,
    request,
  });
  expect(signed.txid).toBe(result.txid);
  expect(journal.saveTransparentPendingTx).toHaveBeenCalledWith(
    expect.objectContaining({
      requireLiveReservation: true,
      tx: expect.objectContaining({
        broadcastAuthorized: false,
        broadcastState: 'unknown',
      }),
    }),
  );
  expect(journal.releaseTransparentReservation).not.toHaveBeenCalled();
});

it.each([
  { feeZat: '1' },
  { expiryHeight: 121 },
  { spentOutpoints: [outpoints[0], outpoints[0]] },
  { spentOutpoints: [outpoints[0]] },
])('rejects a result differing from review: %j', async (change) => {
  const { journal, sign } = setup();
  sign.mockResolvedValue({ ...result, ...change });
  await expect(
    signTransparentTransaction({
      journal,
      sign,
      accountId: 'account',
      encodedTx,
      request,
    }),
  ).rejects.toThrow('did not match');
  expect(journal.saveTransparentPendingTx).not.toHaveBeenCalled();
  expect(journal.releaseTransparentReservation).toHaveBeenCalledWith({
    accountId: 'account',
    ownerId: 'owner',
  });
});

it.each(['sign', 'save'] as const)(
  'releases the reservation when %s fails',
  async (stage) => {
    const { journal, sign } = setup();
    (stage === 'sign'
      ? sign
      : journal.saveTransparentPendingTx
    ).mockRejectedValue(new Error('failure'));
    await expect(
      signTransparentTransaction({
        journal,
        sign,
        accountId: 'account',
        encodedTx,
        request,
      }),
    ).rejects.toThrow('failure');
    expect(journal.releaseTransparentReservation).toHaveBeenCalledTimes(1);
  },
);

it('does not release another owner when reservation acquisition fails', async () => {
  const { journal, sign } = setup();
  journal.reserveTransparentOutpoints.mockRejectedValue(new Error('reserved'));
  await expect(
    signTransparentTransaction({
      journal,
      sign,
      accountId: 'account',
      encodedTx,
      request,
    }),
  ).rejects.toThrow('reserved');
  expect(sign).not.toHaveBeenCalled();
  expect(journal.releaseTransparentReservation).not.toHaveBeenCalled();
});
