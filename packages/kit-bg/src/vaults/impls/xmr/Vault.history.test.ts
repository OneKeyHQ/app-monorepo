/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
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

// undefined would send the address to the server history API, so an
// unanswerable runtime falls back to the cached rows.
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

// Pausing hides the primary address on Receive, so cached rows lose it too.
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
      xmrListHistoryItems: async () => undefined,
      backgroundApi: {
        servicePrivacyChain: {
          getLocalWalletAccountAddresses: async () => ({
            publicAddress: ADDRESS,
            privateAddress,
          }),
        },
        simpleDb: {
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: jest.fn(async () => [selfSend]),
            getAccountLocalHistoryPendingTxs: jest.fn(async () => []),
          },
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
});

// The runtime only knows accounts that turned scanning on at least once.
describe('xmr history for an account that never enabled scanning', () => {
  const localRuntime = jest.mocked(getXmrLocalRuntime);

  beforeEach(() => {
    localRuntime.mockReset();
    localRuntime.mockRejectedValue(
      new OneKeyLocalError('runtime unavailable in this test'),
    );
  });

  function createVault(getAccountState: () => Promise<unknown>) {
    const cached = [{ id: 'cached' }] as unknown as IAccountHistoryTx[];
    const vault: Vault = Object.assign(Object.create(Vault.prototype), {
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getAccountEpoch: async () => undefined,
            getXmrAccountState: jest.fn(getAccountState),
          },
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: jest.fn(async () => cached),
            getAccountLocalHistoryPendingTxs: jest.fn(async () => []),
          },
        },
      },
    });
    return { vault, cached };
  }

  const read = (vault: Vault) =>
    vault.fetchAccountHistoryFromLocal({
      accountId: ACCOUNT_ID,
      networkId: 'xmr--0',
      accountAddress: ADDRESS,
    });

  it('answers from the cached rows without loading the runtime', async () => {
    const { vault, cached } = createVault(async () => ({ intent: 'off' }));
    await expect(read(vault)).resolves.toEqual(cached);
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
    const { vault, cached } = createVault(getAccountState);
    await expect(read(vault)).resolves.toEqual(cached);
    expect(localRuntime).toHaveBeenCalledTimes(1);
  });
});
