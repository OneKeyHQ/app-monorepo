/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { KeyringHd } from './KeyringHd';

import type { IEncodedTxXmr } from './types';
import type Vault from './Vault';
import type { ISignTransactionParams } from '../../types';

function createKeyring() {
  const vault = {
    xmrClaimTransactionReview: jest.fn(async () => undefined),
    xmrMarkReservationSigned: jest.fn(async () => undefined),
    xmrReleaseReservation: jest.fn(async () => undefined),
  };
  const keyring = Object.assign(
    Object.create(KeyringHd.prototype) as KeyringHd,
    { vault: vault as unknown as Vault },
  );
  const encodedTx: IEncodedTxXmr = {
    from: 'synthetic-sender',
    to: 'synthetic-recipient',
    amount: '1',
    amountAtomic: '1000000000000',
    feeAtomic: '30000000',
    changeAtomic: '0',
    priority: 'normal',
    chainTip: 3_767_827,
    reservationId: 'r1',
    signableHex: 'aabb',
    inputCount: 2,
  };
  const params = {
    unsignedTx: { encodedTx },
  } as unknown as ISignTransactionParams;
  return { keyring, vault, params };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// The review is claimed and the reservation marked signed before the spend key
// is used: a signed reservation may be broadcast any moment, so the next
// prepare must not release it as abandoned. A failed signing frees it at once.
describe('xmr signing and reservations', () => {
  it('marks the reservation signed once signing succeeds', async () => {
    const { keyring, vault, params } = createKeyring();
    jest
      .spyOn(KeyringHdBase.prototype, 'baseSignTransaction')
      .mockResolvedValue({ txid: 't', rawTx: 'r', encodedTx: null });

    await keyring.signTransaction(params);

    expect(vault.xmrClaimTransactionReview).toHaveBeenCalledTimes(1);
    expect(vault.xmrMarkReservationSigned).toHaveBeenCalledWith('r1', 2);
    expect(vault.xmrReleaseReservation).not.toHaveBeenCalled();
  });

  it('releases the reservation when signing fails', async () => {
    const { keyring, vault, params } = createKeyring();
    jest
      .spyOn(KeyringHdBase.prototype, 'baseSignTransaction')
      .mockRejectedValue(new Error('bad password'));

    await expect(keyring.signTransaction(params)).rejects.toThrow(
      'bad password',
    );

    expect(vault.xmrReleaseReservation).toHaveBeenCalledWith('r1');
  });

  it('signs nothing when the review no longer holds', async () => {
    const { keyring, vault, params } = createKeyring();
    const sign = jest.spyOn(KeyringHdBase.prototype, 'baseSignTransaction');
    vault.xmrClaimTransactionReview.mockRejectedValue(
      new Error('review expired'),
    );

    await expect(keyring.signTransaction(params)).rejects.toThrow(
      'review expired',
    );

    expect(vault.xmrMarkReservationSigned).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });
});
