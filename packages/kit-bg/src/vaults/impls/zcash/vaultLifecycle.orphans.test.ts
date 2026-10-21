/* cspell:ignore Ufvks */
import { getZcashSyncMutex } from './lifecycle';
import Vault from './Vault';
import {
  zcashPrepareAccounts,
  zcashPurgeRuntimeOrphans,
} from './vaultLifecycle';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const LIVE = 'hd-1--0';
const PAUSED = 'hd-1--1';

function createVault({ pausedMetaVkFp = 'fp-paused' } = {}) {
  const prepareWalletAccounts = jest.fn(async () => undefined);
  const accounts: Record<string, { ufvk: string }> = {
    [LIVE]: { ufvk: 'ufvk-live' },
    [PAUSED]: { ufvk: 'ufvk-paused' },
  };
  const zcashGetWalletAccount = jest.fn(
    async ({ accountId }: { accountId: string }) => accounts[accountId],
  );
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    backgroundApi: {
      simpleDb: {
        privacyChainState: {
          listZcashAccountMetas: async () => [
            { accountId: LIVE, meta: { vkFp: 'fp-live' } },
            { accountId: PAUSED, meta: { vkFp: pausedMetaVkFp } },
          ],
        },
      },
    },
    listLocalWalletAccounts: async () => ({
      accounts: [
        { accountId: LIVE, syncEnabled: true },
        { accountId: PAUSED, syncEnabled: false },
      ],
    }),
    zcashGetWalletAccount,
    zcashHealOutOfRangeBirthdays: async () => undefined,
    zcashGetApi: async () => ({ prepareWalletAccounts }),
  });
  return { vault, prepareWalletAccounts, zcashGetWalletAccount };
}

const retained = [
  { accountId: LIVE, vkFp: 'fp-live', viewingKey: 'ufvk-live' },
  { accountId: PAUSED, vkFp: 'fp-paused', viewingKey: 'ufvk-paused' },
];

describe('zcash runtime orphan cleanup', () => {
  it('keeps every retained key, paused ones included, opening through a scanning account', async () => {
    const { vault, prepareWalletAccounts } = createVault();

    await expect(zcashPurgeRuntimeOrphans(vault, { retained })).resolves.toBe(
      true,
    );

    // Only the scanning account is registered; the paused one is kept by key.
    expect(prepareWalletAccounts).toHaveBeenCalledWith(
      [{ ufvk: 'ufvk-live' }],
      { retainedUfvks: ['ufvk-live', 'ufvk-paused'] },
    );
  });

  it('does not run while the scan lane is held', async () => {
    const { vault, prepareWalletAccounts } = createVault();
    const release = await getZcashSyncMutex('main').acquire();
    try {
      await expect(zcashPurgeRuntimeOrphans(vault, { retained })).resolves.toBe(
        false,
      );
    } finally {
      release();
    }
    expect(prepareWalletAccounts).not.toHaveBeenCalled();
  });

  it('does not run when a key names another identity than its account record', async () => {
    const { vault, prepareWalletAccounts } = createVault({
      pausedMetaVkFp: 'fp-other',
    });
    await expect(zcashPurgeRuntimeOrphans(vault, { retained })).resolves.toBe(
      false,
    );
    expect(prepareWalletAccounts).not.toHaveBeenCalled();
  });

  it('does not run without a scanning account to open the database', async () => {
    const { vault, prepareWalletAccounts } = createVault();
    await expect(
      zcashPurgeRuntimeOrphans(vault, { retained: [retained[1]] }),
    ).resolves.toBe(false);
    expect(prepareWalletAccounts).not.toHaveBeenCalled();
  });

  it('never purges on an ordinary scan turn', async () => {
    const { vault, prepareWalletAccounts } = createVault();
    await zcashPrepareAccounts(vault, { accountIds: [LIVE] });
    expect(prepareWalletAccounts).toHaveBeenCalledWith([{ ufvk: 'ufvk-live' }]);
  });
});
