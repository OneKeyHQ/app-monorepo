/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import Vault from './Vault';

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";
const ADDRESS = '4-synthetic-primary-address';

// undefined from a local-wallet vault sends the account's address to the
// server history API (ServiceHistory falls through). Monero has no server
// history, so an unanswerable runtime must fall back to the cached rows.
describe('xmr history when the runtime cannot answer', () => {
  it('returns the cached rows instead of undefined', async () => {
    const confirmed = [{ id: 'confirmed' }] as unknown as IAccountHistoryTx[];
    const pending = [{ id: 'pending' }] as unknown as IAccountHistoryTx[];
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      xmrListHistoryItems: async () => undefined,
      backgroundApi: {
        simpleDb: {
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: jest.fn(async () => confirmed),
            getAccountLocalHistoryPendingTxs: jest.fn(async () => pending),
          },
        },
      },
    });

    await expect(
      vault.fetchAccountHistoryFromLocal({
        accountId: ACCOUNT_ID,
        networkId: 'xmr--0',
        accountAddress: ADDRESS,
      }),
    ).resolves.toEqual([...confirmed, ...pending]);
  });
});

// A sent row carries `signableHex` (it holds the view key); the shared
// local-history cache refuses rows tagged private.
describe('xmr history stays on the device', () => {
  function createVault() {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      backgroundApi: {
        serviceAccount: {
          getAccountAddressForApi: async () => ADDRESS,
          getAccountXpub: async () => undefined,
        },
      },
    });
  }

  it('tags a locally built row as private', async () => {
    const row = await createVault().buildHistoryTx({
      decodedTx: {
        txid: 'tx1',
        accountId: ACCOUNT_ID,
        networkId: 'xmr--0',
        encodedTx: { signableHex: 'secret' },
      },
      signedTx: { txid: 'tx1' },
    } as never);
    expect(row.privacyChainHistorySide).toBe('private');
  });

  it('never asks the backend for transaction details', async () => {
    await expect(createVault().fetchAccountHistoryDetail()).rejects.toThrow(
      'local only',
    );
  });
});
