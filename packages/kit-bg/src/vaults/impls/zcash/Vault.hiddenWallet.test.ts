/* cspell:ignore Ufvks */
/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import Vault from './Vault';

// A "do not save" hidden wallet is absent from getWallets() once its session
// ends, while its viewing key stays in SimpleDB. Hidden identities must not
// trial-decrypt blocks, but retain both recovery state and admission slots.
function createVault({
  visibleWalletIds,
  tempWalletIds = [],
}: {
  visibleWalletIds: string[];
  tempWalletIds?: string[];
}) {
  return Object.assign(Object.create(Vault.prototype) as Vault, {
    backgroundApi: {
      serviceAccount: {
        getWallets: async () => ({
          wallets: visibleWalletIds.map((id) => ({
            id,
            isTemp: tempWalletIds.includes(id),
          })),
        }),
      },
      simpleDb: {
        privacyChainState: {
          listZcashMetaAccountIds: async () => ['hd-saved--1', 'hd-hidden--1'],
          listZcashAccountMetas: async () =>
            ['hd-saved--1', 'hd-hidden--1'].map((accountId, index) => ({
              accountId,
              meta: { vkFp: String(index).repeat(32) },
            })),
          listZcashEnabledAccountIds: async () => [
            'hd-saved--1',
            'hd-hidden--1',
          ],
          listAccountIds: async () => [],
        },
        privacyChainJournal: {
          listZcashTransparentAccountIds: async () => [],
        },
      },
    },
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

  // Unlocked but not kept: privacy is unavailable for it, so it does not scan
  // either, and resumes like a re-unlocked wallet once it is kept.
  it('does not scan an unlocked wallet the user chose not to keep', async () => {
    const vault = createVault({
      visibleWalletIds: ['hd-saved', 'hd-hidden'],
      tempWalletIds: ['hd-hidden'],
    });

    const { accounts } = await vault.listLocalWalletAccounts();

    expect(
      accounts.map(({ accountId, syncEnabled, slotEnabled }) => [
        accountId,
        syncEnabled,
        slotEnabled,
      ]),
    ).toEqual([
      ['hd-saved--1', true, true],
      ['hd-hidden--1', false, true],
    ]);
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
    const entity = new SimpleDbEntityPrivacyChainState();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    for (const id of ['a', 'b']) {
      await entity.beginZcashPrivacyModeEnable({
        networkId: 'zec--0',
        accountId: id,
        birthdayHeight: 2_000_000,
      });
      await entity.saveZcashAccountMeta({
        accountId: id,
        meta: {
          vkFp: id.repeat(32),
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: '00'.repeat(32),
          hdIndex: 0,
          birthdayHeight: 2_000_000,
          createdAt: 1,
        },
      });
      await entity.completeZcashPrivacyModeEnable({ accountId: id });
    }
    if (!hasProgress) {
      // The state names only a month; the resolved height is the meta's.
      await entity.setRawData((data) => {
        const record = data?.accounts?.a as {
          scan: Record<string, unknown>;
        };
        return {
          ...data,
          accounts: {
            ...data?.accounts,
            a: {
              ...record,
              scan: {
                ...record.scan,
                birthdayRequest: { timestamp: 1_700_000_000_000 },
              },
            },
          },
        };
      });
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
          simpleDb: { privacyChainState: entity },
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
        zcashHasAccountViewingKey: async () => true,
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
                (await entity.getZcashPrivacyModeState({ accountId: 'a' }))
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
      (await entity.getZcashPrivacyModeState({ accountId: 'a' }))
        .scanExcludedFromHeight,
    ).toBeUndefined();
  },
);

it.each([false, true])(
  'recovers by viewing identity while an alias remains hidden (existing exclusion: %s)',
  async (existingExclusion) => {
    let saved: unknown = null;
    const entity = new SimpleDbEntityPrivacyChainState();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    for (const accountId of ['hidden', 'visible']) {
      await entity.beginZcashPrivacyModeEnable({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 2_000_000,
      });
      await entity.saveZcashAccountMeta({
        accountId,
        meta: {
          vkFp: 'c'.repeat(32),
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: '00'.repeat(32),
          hdIndex: 0,
          birthdayHeight: 2_000_000,
          createdAt: 1,
        },
      });
      await entity.completeZcashPrivacyModeEnable({ accountId });
    }
    if (existingExclusion) {
      await entity.markZcashScanExcluded({
        accountId: 'hidden',
        fromHeight: 2_250_000,
      });
    }
    let reveal = false;
    const progress = jest.fn(async () => ({
      isBackfillComplete: false,
      birthdayHeight: 2_000_000,
    }));
    const markExcluded = jest.spyOn(entity, 'markZcashScanExcluded');
    const readState = jest.spyOn(entity, 'getZcashPrivacyModeState');
    const queueRescan = jest.fn(async () => ({ queued: true }));
    const prepareAccounts = jest.fn(async () => [
      { ufvk: 'shared-viewing-identity' },
    ]);
    const syncWallet = jest.fn(async () => ({ stateChanged: true }));
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      backgroundApi: {
        simpleDb: { privacyChainState: entity },
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
      zcashHasAccountViewingKey: async () => true,
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
      (await entity.getZcashPrivacyModeState({ accountId: 'hidden' }))
        .scanExcludedFromHeight,
    ).toBeUndefined();
    queueRescan.mockClear();
    reveal = true;
    await vault.syncLocalWalletGroup({ accountIds: ['hidden', 'visible'] });
    expect(queueRescan).not.toHaveBeenCalled();
  },
);
