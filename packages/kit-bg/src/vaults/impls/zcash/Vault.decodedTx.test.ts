/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import Vault from './Vault';

import type { IEncodedTxZcash } from './types';

// The confirm page skips its generic balance check for a PSBT-like tx. A
// private send's notes stay spendable until the signed transaction is stored,
// so without the flag the check counted them as unavailable and refused the send.
describe('Zcash decoded transaction', () => {
  function transaction(
    overrides: Partial<IEncodedTxZcash> = {},
  ): IEncodedTxZcash {
    return {
      inputs: [],
      outputs: [{ address: 'u1-recipient', value: '100000' }],
      inputsForCoinSelect: [],
      outputsForCoinSelect: [],
      txSize: 0,
      zcashTo: 'u1-recipient',
      zcashAmountValue: '100000',
      fee: '15000',
      zcashMode: 'privacy',
      zcashSpendSource: 'ironwood',
      pcztHex: 'aa',
      ...overrides,
    };
  }
  function createVault() {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      networkId: 'zec--0',
      getNetwork: async () => ({ decimals: 8 }),
      getAccount: async () => ({ address: 't1-own' }),
      backgroundApi: {
        serviceToken: { getToken: async () => undefined },
      },
    });
  }
  function decode(overrides: Partial<IEncodedTxZcash>) {
    const encodedTx = transaction(overrides);
    const vault = createVault();
    return vault.buildDecodedTx({
      unsignedTx: { encodedTx },
    });
  }

  it('marks a private send carrying a PCZT as PSBT-like', async () => {
    await expect(decode({ pcztHex: 'aa' })).resolves.toMatchObject({
      isPsbt: true,
    });
  });

  it('leaves a transparent send to the normal balance check', async () => {
    await expect(
      decode({ zcashMode: 'transparent', pcztHex: undefined }),
    ).resolves.toMatchObject({
      isPsbt: false,
    });
  });

  it('holds a snapshot when the calling runtime mutates the object during an await', async () => {
    const encodedTx = transaction();
    const vault = createVault();
    const pending = vault.buildDecodedTx({ unsignedTx: { encodedTx } });
    encodedTx.zcashTo = 'changed-recipient';
    encodedTx.zcashAmountValue = '200000';
    encodedTx.outputs[0].address = 'changed-recipient';
    encodedTx.outputs[0].value = '200000';
    const decoded = await pending;
    expect(decoded.nativeAmountValue).toBe('100000');
    expect(decoded.encodedTx).not.toBe(encodedTx);
    expect(decoded.actions[0].unknownAction?.to).toBe('u1-recipient');
  });
});
