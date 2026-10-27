/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');
jest.mock('./runtime', () => ({
  ...jest.requireActual<typeof import('./runtime')>('./runtime'),
  getXmrLocalRuntime: jest.fn(),
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { getXmrLocalRuntime } from './runtime';
import Vault from './Vault';

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";
const ADDRESS = '4-synthetic-primary-address';

// `undefined` would hit the server history API and an empty list would blank
// the page; a throw keeps the rows shown.
describe('xmr history when the runtime cannot answer', () => {
  it('throws instead of answering empty or undefined', async () => {
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      xmrIsHistoryNeverEnabled: async () => false,
      xmrListHistoryItems: async () => undefined,
    });

    await expect(
      vault.fetchAccountHistoryFromLocal({
        accountId: ACCOUNT_ID,
        networkId: 'xmr--0',
        accountAddress: ADDRESS,
      }),
    ).rejects.toThrow('xmr: history unavailable');
  });
});

describe('xmr history shows our primary address only while Receive does', () => {
  it.each([
    ['scanning', ADDRESS, ADDRESS],
    ['paused', undefined, ''],
  ])('%s', async (_, privateAddress, shown) => {
    const selfSend = {
      id: 'self-send',
      decodedTx: {
        txid: 'self-send',
        owner: ADDRESS,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            assetTransfer: {
              from: '',
              to: ADDRESS,
              shieldedFrom: { poolId: 1, isOwn: true },
              sends: [
                {
                  from: '',
                  to: ADDRESS,
                  shieldedFrom: { poolId: 1, isOwn: true },
                },
              ],
              receives: [],
            },
          },
        ],
      },
    } as unknown as IAccountHistoryTx;
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      xmrBuildHistoryTxs: async () => [selfSend],
      backgroundApi: {
        servicePrivacyChain: {
          getLocalWalletAccountAddresses: async () => ({
            publicAddress: ADDRESS,
            privateAddress,
          }),
        },
      },
    });
    const [row] =
      (await vault.fetchAccountHistoryFromLocal({
        accountId: ACCOUNT_ID,
        networkId: 'xmr--0',
        accountAddress: ADDRESS,
      })) ?? [];
    const transfer = row.decodedTx.actions[0].assetTransfer;
    expect(transfer?.to).toBe(shown);
    expect(transfer?.sends[0].to).toBe(shown);
  });
});

// A sent row carries `signableHex` (holds the view key), so it is tagged private
// and kept out of the shared local-history cache.
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
});

describe('xmr history for an account that never enabled scanning', () => {
  const localRuntime = jest.mocked(getXmrLocalRuntime);

  beforeEach(() => {
    localRuntime.mockReset();
    localRuntime.mockRejectedValue(
      new OneKeyLocalError('runtime unavailable in this test'),
    );
  });

  function createVault(getAccountState: () => Promise<unknown>) {
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getAccountEpoch: async () => undefined,
            getXmrAccountState: jest.fn(getAccountState),
          },
        },
      },
    });
    return { vault };
  }

  const read = (vault: Vault) =>
    vault.fetchAccountHistoryFromLocal({
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      accountAddress: ADDRESS,
    });

  it('answers empty without loading the runtime', async () => {
    const { vault } = createVault(async () => ({ intent: 'off' }));
    await expect(read(vault)).resolves.toEqual([]);
    expect(localRuntime).not.toHaveBeenCalled();
  });

  it.each([
    ['paused', async () => ({ intent: 'off', resumeFromHeight: 3_100_000 })],
    ['enabled', async () => ({ intent: 'on' })],
    [
      'unreadable state',
      async () => {
        throw new OneKeyLocalError('simpledb: invalid persisted data (xmr)');
      },
    ],
  ])('still reads the runtime when %s', async (_label, getAccountState) => {
    const { vault } = createVault(getAccountState);
    await expect(read(vault)).rejects.toThrow('xmr: history unavailable');
    expect(localRuntime).toHaveBeenCalledTimes(1);
  });
});
