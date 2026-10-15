/* cspell:ignore Ufvks */
/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

import Vault from './Vault';

// A "do not save" hidden wallet is absent from getWallets() once its session
// ends, while its viewing key stays in SimpleDB. Hidden identities must not
// trial-decrypt blocks, but retain both recovery state and admission slots.
function createVault({ visibleWalletIds }: { visibleWalletIds: string[] }) {
  return Object.assign(Object.create(Vault.prototype) as Vault, {
    backgroundApi: {
      serviceAccount: {
        getWallets: async () => ({
          wallets: visibleWalletIds.map((id) => ({ id })),
        }),
      },
      simpleDb: {
        zcash: {
          listAccountIds: async () => ['hd-saved--1', 'hd-hidden--1'],
          listPrivacyModeEnabledAccountIds: async () => [
            'hd-saved--1',
            'hd-hidden--1',
          ],
          listCleanupAccountIds: async () => [],
        },
      },
    },
    zcashGetWalletAccount: async ({ accountId }: { accountId: string }) => ({
      network: 'main',
      ufvk: `ufvk-${accountId}`,
    }),
  });
}

describe('Zcash scanning follows hidden-wallet visibility', () => {
  it('stops scanning an account whose wallet is no longer unlocked', async () => {
    const vault = createVault({ visibleWalletIds: ['hd-saved'] });

    const { accounts } = await vault.listLocalWalletAccounts();

    expect(
      accounts.map(({ accountId, syncEnabled }) => [accountId, syncEnabled]),
    ).toEqual([
      ['hd-saved--1', true],
      ['hd-hidden--1', false],
    ]);
  });

  it('scans it again once that wallet is unlocked', async () => {
    const vault = createVault({
      visibleWalletIds: ['hd-saved', 'hd-hidden'],
    });

    const { accounts } = await vault.listLocalWalletAccounts();

    expect(accounts.every(({ syncEnabled }) => syncEnabled)).toBe(true);
  });

  it('keeps the account listed so its cache and slot bookkeeping survive', async () => {
    const vault = createVault({ visibleWalletIds: ['hd-saved'] });

    const { accounts } = await vault.listLocalWalletAccounts();

    // Deliberately not filtered out: dropping the row would read as "account
    // gone" to the GC pass, which purges cache the user expects to find on
    // the next unlock.
    expect(accounts).toHaveLength(2);
    expect(accounts.every(({ slotEnabled }) => slotEnabled)).toBe(true);
  });
});

it.each([true, false])(
  'recovers hidden scan exclusions after restart (progress available: %s)',
  async (hasProgress) => {
    let saved: unknown = null;
    const entity = new SimpleDbEntityZcash();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    for (const id of ['a', 'b']) {
      await entity.beginPrivacyModeEnable({
        accountId: id,
        birthdayHeight: 2_000_000,
      });
      await entity.saveAccountMeta({
        accountId: id,
        meta: {
          ufvk: id,
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: '00',
          hdIndex: 0,
          birthdayHeight: 2_000_000,
          createdAt: 1,
        },
      });
      await entity.completePrivacyModeEnable({ accountId: id });
    }
    if (!hasProgress) {
      await entity.setRawData((data) => ({
        ...data,
        accounts: data?.accounts ?? {},
        privacyModeAccounts: {
          ...data?.privacyModeAccounts,
          a: {
            intent: 'on',
            birthdayTimestamp: 1_700_000_000_000,
            updatedAt: 1,
          },
        },
      }));
    }
    const expectedCursor = hasProgress ? 2_499_900 : 2_000_000;
    let hidden = true;
    let queueFrom: number | undefined;
    let foundNote = false;
    const scannedKeys: string[][] = [];
    const makeVault = () => {
      const vault = Object.create(Vault.prototype) as Vault;
      Object.assign(vault, {
        backgroundApi: {
          simpleDb: { zcash: entity },
          servicePrivacyChain: { isLocalWalletScanAllowed: async () => true },
        },
        listLocalWalletAccounts: async () => ({
          accounts: ['a', 'b'].map((accountId) => ({
            accountId,
            runtimeKey: 'main',
            accountRuntimeKey: accountId,
            syncEnabled: accountId === 'b' || !hidden,
          })),
        }),
        zcashResumePendingRescans: async () => undefined,
        zcashPrepareAccounts: async ({
          accountIds,
        }: {
          accountIds: string[];
        }) => accountIds.map((ufvk) => ({ ufvk })),
        zcashGetWalletAccount: async () => ({ ufvk: 'b' }),
        getLocalWalletSyncProgress: async () => ({
          isBackfillComplete: hasProgress,
          birthdayHeight: null,
          tipScannedHeight: hasProgress ? 2_500_000 : null,
          chainTip: hasProgress ? 2_500_000 : null,
        }),
        queueLocalWalletRescanFrom: async ({
          fromHeight,
        }: {
          fromHeight: number;
        }) => {
          queueFrom = fromHeight;
        },
        zcashGetApi: async () => ({
          syncWallet: async (
            _account: unknown,
            { activeUfvks }: { activeUfvks: string[] },
          ) => {
            scannedKeys.push(activeUfvks);
            if (hidden) {
              expect(
                (await entity.getPrivacyModeState({ accountId: 'a' }))
                  .scanExcludedFromHeight,
              ).toBe(expectedCursor);
            } else if (
              activeUfvks.includes('a') &&
              queueFrom !== undefined &&
              queueFrom <= 2_500_001
            ) {
              foundNote = true;
            }
            queueFrom = undefined;
            return { stateChanged: true };
          },
        }),
      });
      return vault;
    };
    await makeVault().syncLocalWalletGroup({ accountIds: ['b'] });
    expect(scannedKeys).toEqual([['b']]);
    hidden = false;
    // A new Vault instance has no in-memory visibility history.
    await makeVault().syncLocalWalletGroup({ accountIds: ['a', 'b'] });
    expect(scannedKeys[1]).toEqual(['a', 'b']);
    expect(foundNote).toBe(true);
    expect(
      (await entity.getPrivacyModeState({ accountId: 'a' }))
        .scanExcludedFromHeight,
    ).toBeUndefined();
  },
);

it.each([false, true])(
  'recovers by viewing identity while an alias remains hidden (existing exclusion: %s)',
  async (existingExclusion) => {
    let saved: unknown = null;
    const entity = new SimpleDbEntityZcash();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    for (const accountId of ['hidden', 'visible']) {
      await entity.beginPrivacyModeEnable({
        accountId,
        birthdayHeight: 2_000_000,
      });
      await entity.saveAccountMeta({
        accountId,
        meta: {
          ufvk: 'shared-viewing-identity',
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: '00',
          hdIndex: 0,
          birthdayHeight: 2_000_000,
          createdAt: 1,
        },
      });
      await entity.completePrivacyModeEnable({ accountId });
    }
    if (existingExclusion) {
      await entity.markPrivacyModeScanExcluded({
        accountId: 'hidden',
        fromHeight: 2_250_000,
      });
    }
    let reveal = false;
    const progress = jest.fn(async () => ({
      isBackfillComplete: false,
      birthdayHeight: 2_000_000,
    }));
    const markExcluded = jest.spyOn(entity, 'markPrivacyModeScanExcluded');
    const readState = jest.spyOn(entity, 'getPrivacyModeState');
    const queueRescan = jest.fn(async () => ({ queued: true }));
    const prepareAccounts = jest.fn(async () => [
      { ufvk: 'shared-viewing-identity' },
    ]);
    const syncWallet = jest.fn(async () => ({ stateChanged: true }));
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      backgroundApi: {
        simpleDb: { zcash: entity },
        servicePrivacyChain: { isLocalWalletScanAllowed: async () => true },
      },
      listLocalWalletAccounts: async () => ({
        accounts: ['hidden', 'visible'].map((accountId) => ({
          accountId,
          runtimeKey: 'main',
          accountRuntimeKey: 'shared-viewing-identity',
          syncEnabled: accountId === 'visible' || reveal,
        })),
      }),
      zcashResumePendingRescans: async () => undefined,
      zcashPrepareAccounts: prepareAccounts,
      zcashGetWalletAccount: async () => ({ ufvk: 'shared-viewing-identity' }),
      zcashGetApi: async () => ({ syncWallet }),
      getLocalWalletSyncProgress: progress,
      queueLocalWalletRescanFrom: queueRescan,
    });
    await vault.syncLocalWalletGroup({ accountIds: ['visible'] });
    expect(readState).toHaveBeenCalledTimes(2);
    expect(prepareAccounts).toHaveBeenCalledWith({
      accountIds: ['visible'],
      chainTip: undefined,
    });
    expect(syncWallet).toHaveBeenCalledWith(expect.anything(), {
      activeUfvks: ['shared-viewing-identity'],
      chainTip: undefined,
    });
    expect(markExcluded).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    if (existingExclusion) {
      expect(queueRescan).toHaveBeenCalledWith({
        accountId: 'hidden',
        fromHeight: 2_250_000,
      });
    } else {
      expect(queueRescan).not.toHaveBeenCalled();
    }
    expect(
      (await entity.getPrivacyModeState({ accountId: 'hidden' }))
        .scanExcludedFromHeight,
    ).toBeUndefined();
    queueRescan.mockClear();
    reveal = true;
    await vault.syncLocalWalletGroup({ accountIds: ['hidden', 'visible'] });
    expect(queueRescan).not.toHaveBeenCalled();
  },
);
