/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { getZcashPcztReviewDigest } from './pcztReview';
import Vault from './Vault';

import type { IEncodedTxZcash } from './types';

// The confirm page skips its generic balance check for a PSBT-like tx. A
// private send's own notes are locked by its PCZT, so without the flag the
// check counted them as unavailable and refused the send.
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
      pcztReservationId: 'review',
      ...overrides,
    };
  }
  function createVault(
    approved: IEncodedTxZcash,
    reviewDigest?: string,
    reservationState: 'unsigned' | 'signed' = 'unsigned',
  ) {
    const digest =
      reviewDigest ??
      (approved.zcashMode === 'privacy' && approved.pcztHex
        ? getZcashPcztReviewDigest({
            accountId: 'acc',
            networkId: 'zec--0',
            encodedTx: approved,
            ufvk: 'synthetic-ufvk',
          })
        : undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      networkId: 'zec--0',
      getNetwork: async () => ({ decimals: 8 }),
      getAccount: async () => ({ address: 't1-own' }),
      backgroundApi: {
        serviceToken: { getToken: async () => undefined },
        simpleDb: {
          zcash: {
            getAccountMeta: async () => ({ ufvk: 'synthetic-ufvk' }),
            listShieldedReservations: async () => [
              {
                reservationId: 'review',
                state: reservationState,
                reviewDigest: digest,
              },
            ],
          },
        },
      },
    });
    return vault;
  }
  function decode(overrides: Partial<IEncodedTxZcash>) {
    const encodedTx = transaction(overrides);
    const vault = createVault(encodedTx);
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
    const vault = createVault(encodedTx);
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

  it('refuses a stale approval before presenting a confirmation', async () => {
    const encodedTx = transaction();
    const vault = createVault(encodedTx, 'replaced-approval');
    await expect(
      vault.buildDecodedTx({ unsignedTx: { encodedTx } }),
    ).rejects.toMatchObject({ code: 'STALE_PRIVACY_TRANSACTION' });
  });

  // A signed reservation means the last submit's outcome never came back;
  // "review again" would invite paying a second time.
  it('tells the user to check history when the last submit is unresolved', async () => {
    const encodedTx = transaction();
    const vault = createVault(encodedTx, undefined, 'signed');
    await expect(
      vault.buildDecodedTx({ unsignedTx: { encodedTx } }),
    ).rejects.toMatchObject({ code: 'FINALIZE_OUTCOME_UNKNOWN' });
  });

  it('requires a proposal for every private payment confirmation', async () => {
    const encodedTx = transaction({ pcztHex: undefined });
    const vault = createVault(transaction());
    await expect(
      vault.buildDecodedTx({ unsignedTx: { encodedTx } }),
    ).rejects.toThrow();
  });
  it('rejects memo changes after approval, including removal', async () => {
    const approved = transaction({
      zcashMemoHex: `ff000102${'00'.repeat(508)}`,
    });
    for (const zcashMemoHex of [undefined, `ff99${'00'.repeat(510)}`]) {
      const vault = createVault(approved);
      const changed: IEncodedTxZcash = { ...approved, zcashMemoHex };
      await expect(
        vault.buildDecodedTx({
          unsignedTx: { encodedTx: changed },
        }),
      ).rejects.toMatchObject({ code: 'STALE_PRIVACY_TRANSACTION' });
    }
  });
});
