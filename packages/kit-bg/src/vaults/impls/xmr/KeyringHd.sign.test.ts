/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { KeyringHdBase } from '../../base/KeyringHdBase';

import { KeyringHd } from './KeyringHd';

import type { IEncodedTxXmr } from './types';
import type { ISignTransactionParams } from '../../types';

function createKeyring(encodedTxOverride?: Partial<IEncodedTxXmr>) {
  const keyring = Object.create(KeyringHd.prototype) as KeyringHd;
  const encodedTx: IEncodedTxXmr = {
    from: 'synthetic-sender',
    to: 'synthetic-recipient',
    amount: '1',
    amountAtomic: '1000000000000',
    feeAtomic: '30000000',
    changeAtomic: '0',
    priority: 'normal',
    chainTip: 3_767_827,
    signableHex: 'aabb',
    inputCount: 2,
    ...encodedTxOverride,
  };
  const params = {
    unsignedTx: { encodedTx },
  } as unknown as ISignTransactionParams;
  return { keyring, params, encodedTx };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// The runtime re-verifies the review against `signableHex` inside signing, so
// the keyring only validates the shape and delegates.
describe('xmr signing', () => {
  it('delegates the validated transaction to the core signer', async () => {
    const { keyring, params, encodedTx } = createKeyring();
    const sign = jest
      .spyOn(KeyringHdBase.prototype, 'baseSignTransaction')
      .mockResolvedValue({ txid: 't', rawTx: 'r', encodedTx: null });

    await expect(keyring.signTransaction(params)).resolves.toMatchObject({
      txid: 't',
    });

    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign.mock.calls[0][0].unsignedTx.encodedTx).toEqual(encodedTx);
  });

  it('propagates a signing failure', async () => {
    const { keyring, params } = createKeyring();
    jest
      .spyOn(KeyringHdBase.prototype, 'baseSignTransaction')
      .mockRejectedValue(new Error('bad password'));

    await expect(keyring.signTransaction(params)).rejects.toThrow(
      'bad password',
    );
  });

  it('signs nothing when the transaction was never built', async () => {
    const { keyring, params } = createKeyring({ signableHex: undefined });
    const sign = jest.spyOn(KeyringHdBase.prototype, 'baseSignTransaction');

    await expect(keyring.signTransaction(params)).rejects.toThrow(
      'invalid transaction review',
    );

    expect(sign).not.toHaveBeenCalled();
  });
});
