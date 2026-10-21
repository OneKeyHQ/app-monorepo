import { SimpleDbEntityZcash } from './SimpleDbEntityZcash';

import type { IZcashDB } from './SimpleDbEntityZcash';

function createEntity(initial?: IZcashDB) {
  let saved: unknown = initial ? { data: initial, updatedAt: 1 } : null;
  const entity = new SimpleDbEntityZcash();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}

describe('SimpleDbEntityZcash account cleanup', () => {
  it('discovers and removes orphaned account state', async () => {
    const entity = createEntity({
      accounts: {
        account: {
          vkFp: 'a'.repeat(32),
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: 'fingerprint',
          hdIndex: 0,
          createdAt: 1,
        },
      },
    });

    await expect(entity.listCleanupAccountIds()).resolves.toEqual(['account']);
    await entity.removeAccountState({ accountId: 'account' });

    await expect(entity.listCleanupAccountIds()).resolves.toEqual([]);
  });
});

describe('SimpleDbEntityZcash privacy mode', () => {
  const meta = {
    vkFp: 'b'.repeat(32),
    unifiedAddress: 'u1',
    transparentAddress: 't1',
    seedFingerprintHex: 'fingerprint',
    hdIndex: 0,
    birthdayHeight: 2000,
    birthdaySource: 'manual-height' as const,
    createdAt: 1,
  };

  it('stores fresh-wallet provenance atomically', async () => {
    const entity = createEntity({ accounts: {} });

    await entity.saveWalletCreationProvenance({
      walletId: 'hd-1',
      isFreshlyGeneratedMnemonic: true,
      createdAt: 1_700_000_000_000,
    });

    await expect(
      entity.getWalletFreshMnemonic({ walletId: 'hd-1' }),
    ).resolves.toBe(true);
    await expect(
      entity.getWalletCreatedAtTimestamp({ walletId: 'hd-1' }),
    ).resolves.toBe(1_700_000_000_000);
  });

  it('treats missing state as off without migrating existing metadata', async () => {
    const entity = createEntity({ accounts: { account: meta } });

    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toEqual({ intent: 'off' });
    await expect(
      entity.isPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
    await expect(entity.listPrivacyModeEnabledAccountIds()).resolves.toEqual(
      [],
    );
  });

  it('persists an off account and its recommended creation month', async () => {
    const entity = createEntity({ accounts: {} });

    await entity.initializePrivacyModeOff({
      accountId: 'account',
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });

    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });
  });

  it('backfills a fresh-wallet month without overwriting an explicit hint', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'fresh-account' });
    await entity.initializePrivacyModeOff({
      accountId: 'imported-account',
      birthdayMonthHint: {
        timestamp: 1_600_000_000_000,
        source: 'imported-wallet',
      },
    });

    await entity.backfillPrivacyModeBirthdayMonthHint({
      accountIds: ['fresh-account', 'imported-account'],
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });

    await expect(
      entity.getPrivacyModeState({ accountId: 'fresh-account' }),
    ).resolves.toMatchObject({
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });
    await expect(
      entity.getPrivacyModeState({ accountId: 'imported-account' }),
    ).resolves.toMatchObject({
      birthdayMonthHint: {
        timestamp: 1_600_000_000_000,
        source: 'imported-wallet',
      },
    });
  });

  it('stays off through enable setup and turns on only after completion', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'account' });
    await entity.beginPrivacyModeEnable({
      accountId: 'account',
      birthdayHeight: 2000,
    });

    await expect(
      entity.isPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
    await entity.saveAccountMeta({ accountId: 'account', meta });
    await expect(entity.listPrivacyModeEnabledAccountIds()).resolves.toEqual(
      [],
    );

    await entity.completePrivacyModeEnable({ accountId: 'account' });

    await expect(
      entity.isPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(true);
    await expect(entity.listPrivacyModeEnabledAccountIds()).resolves.toEqual([
      'account',
    ]);
  });

  it('records an imported month only when enable is explicitly requested', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'account' });

    await entity.beginPrivacyModeEnable({
      accountId: 'account',
      birthdayTimestamp: 1_650_000_000_000,
    });

    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayMonthHint: {
        timestamp: 1_650_000_000_000,
        source: 'imported-wallet',
      },
      operation: { type: 'enable' },
    });
  });

  it('rolls an interrupted enable back to retryable off on startup', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'account' });
    await entity.beginPrivacyModeEnable({
      accountId: 'account',
      birthdayHeight: 2000,
    });

    await expect(entity.cancelPendingPrivacyModeEnables()).resolves.toEqual([
      'account',
    ]);
    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayHeight: 2000,
    });
    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.not.toHaveProperty('operation');
  });

  it('rejects invalid birthday values before writing an enable journal', async () => {
    const entity = createEntity({ accounts: {} });

    await expect(
      entity.beginPrivacyModeEnable({
        accountId: 'account',
        birthdayHeight: Number.NaN,
      }),
    ).rejects.toThrow('privacy birthday height is invalid');
    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toEqual({ intent: 'off' });
  });

  it('counts enabled aliases of one viewing key once', async () => {
    const entity = createEntity({ accounts: {} });
    for (const accountId of ['account-1', 'account-2']) {
      // eslint-disable-next-line no-await-in-loop
      await entity.initializePrivacyModeOff({ accountId });
      // eslint-disable-next-line no-await-in-loop
      await entity.beginPrivacyModeEnable({
        accountId,
        birthdayHeight: 2000,
      });
      // eslint-disable-next-line no-await-in-loop
      await entity.saveAccountMeta({ accountId, meta });
      // eslint-disable-next-line no-await-in-loop
      await entity.completePrivacyModeEnable({
        accountId,
        maxEnabledAccounts: 1,
      });
    }

    await expect(entity.listPrivacyModeEnabledAccountIds()).resolves.toEqual([
      'account-1',
      'account-2',
    ]);
  });

  it('fails closed while disabling and retains birthday and resume height', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'account' });
    await entity.beginPrivacyModeEnable({
      accountId: 'account',
      birthdayHeight: 2000,
    });
    await entity.saveAccountMeta({ accountId: 'account', meta });
    await entity.completePrivacyModeEnable({ accountId: 'account' });

    await entity.beginPrivacyModeDisable({
      accountId: 'account',
      resumeFromHeight: 2900,
    });

    await expect(
      entity.isPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
    await expect(entity.listPendingPrivacyModeDisables()).resolves.toEqual([
      'account',
    ]);
    await entity.completePrivacyModeDisable({ accountId: 'account' });
    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayHeight: 2000,
      resumeFromHeight: 2900,
    });
  });

  it('deletes viewing metadata without deleting the retained privacy birthday', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'account' });
    await entity.beginPrivacyModeEnable({
      accountId: 'account',
      birthdayHeight: 2000,
    });
    await entity.saveAccountMeta({ accountId: 'account', meta });
    await entity.completePrivacyModeEnable({ accountId: 'account' });
    await entity.beginPrivacyModeDisable({
      accountId: 'account',
      resumeFromHeight: 2900,
    });
    await entity.completePrivacyModeDisable({ accountId: 'account' });

    await entity.removeAccountMeta({ accountId: 'account' });

    await expect(
      entity.getAccountMeta({ accountId: 'account' }),
    ).resolves.toBeUndefined();
    const state = await entity.getPrivacyModeState({ accountId: 'account' });
    expect(state).toMatchObject({ intent: 'off', birthdayHeight: 2000 });
    // The cursor pointed into the cache this call just deleted. Leaving it
    // would make the account read as merely paused, and the UI would offer
    // "Resume" to someone who had asked to delete their privacy data.
    expect(state.resumeFromHeight).toBeUndefined();
  });
});

describe('SimpleDbEntityZcash targeted enable cancellation', () => {
  it('leaves another account enable untouched when one setup fails', async () => {
    const entity = createEntity();
    await entity.beginPrivacyModeEnable({
      accountId: 'failed',
      birthdayHeight: 2_000_000,
    });
    await entity.beginPrivacyModeEnable({
      accountId: 'other',
      birthdayHeight: 2_000_000,
    });

    await entity.cancelPendingPrivacyModeEnables({ accountId: 'failed' });

    await expect(
      entity.getPrivacyModeState({ accountId: 'failed' }),
    ).resolves.toMatchObject({ intent: 'off' });
    expect(
      (await entity.getPrivacyModeState({ accountId: 'failed' })).operation,
    ).toBeUndefined();
    expect(
      (await entity.getPrivacyModeState({ accountId: 'other' })).operation
        ?.type,
    ).toBe('enable');
  });
});

describe('SimpleDbEntityZcash atomic enable admission', () => {
  it('enforces the viewing-identity limit when concurrent retries complete', async () => {
    const entity = createEntity();
    for (let index = 0; index < 6; index += 1) {
      const accountId = `account-${index}`;
      await entity.beginPrivacyModeEnable({
        accountId,
        birthdayHeight: 2_000_000,
      });
      await entity.saveAccountMeta({
        accountId,
        meta: {
          vkFp: String(index).repeat(32),
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: '00',
          hdIndex: index,
          createdAt: 1,
        },
      });
      if (index < 4)
        await entity.completePrivacyModeEnable({
          accountId,
          maxEnabledAccounts: 5,
        });
    }

    const outcomes = await Promise.allSettled(
      [4, 5].map((index) =>
        entity.completePrivacyModeEnable({
          accountId: `account-${index}`,
          maxEnabledAccounts: 5,
        }),
      ),
    );

    expect(outcomes.map(({ status }) => status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await entity.listPrivacyModeEnabledAccountIds()).toHaveLength(5);
    await entity.beginPrivacyModeEnable({
      accountId: 'alias',
      birthdayHeight: 2_000_000,
    });
    await entity.saveAccountMeta({
      accountId: 'alias',
      meta: {
        vkFp: '0'.repeat(32),
        unifiedAddress: 'u1',
        transparentAddress: 't1',
        seedFingerprintHex: '00',
        hdIndex: 0,
        createdAt: 1,
      },
    });
    await expect(
      entity.completePrivacyModeEnable({
        accountId: 'alias',
        maxEnabledAccounts: 5,
      }),
    ).resolves.toBeUndefined();
  });
});

it('does not let an old rescan completion consume a newer repair journal', async () => {
  const entity = createEntity();
  const previous = {
    birthdayHeight: 2_000_000,
    birthdaySource: 'manual-height' as const,
    requestedAt: 1,
  };
  const current = { ...previous, birthdayHeight: 3_000_000, requestedAt: 2 };
  await entity.savePendingRescan({ accountId: 'account', repair: current });

  await entity.removePendingRescan({
    accountId: 'account',
    expectedRepair: previous,
  });

  await expect(entity.listPendingRescans()).resolves.toEqual([
    { accountId: 'account', repair: current },
  ]);
});

describe('SimpleDbEntityZcash interrupted operations', () => {
  it('cancels only enables journaled before this process started', async () => {
    const entity = createEntity({
      accounts: {},
      privacyModeAccounts: {
        stale: {
          intent: 'off',
          operation: { type: 'enable', requestedAt: 100 },
          updatedAt: 100,
        },
        running: {
          intent: 'off',
          operation: { type: 'enable', requestedAt: 300 },
          updatedAt: 300,
        },
      },
    });

    await expect(
      entity.cancelPendingPrivacyModeEnables({ requestedBefore: 200 }),
    ).resolves.toEqual(['stale']);
    await expect(
      entity.getPrivacyModeState({ accountId: 'running' }),
    ).resolves.toMatchObject({ operation: { type: 'enable' } });
  });

  it('lists only disables journaled before this process started', async () => {
    const entity = createEntity({
      accounts: {},
      privacyModeAccounts: {
        stale: {
          intent: 'on',
          operation: { type: 'disable', requestedAt: 100 },
          updatedAt: 100,
        },
        running: {
          intent: 'on',
          operation: { type: 'disable', requestedAt: 300 },
          updatedAt: 300,
        },
      },
    });

    await expect(
      entity.listPendingPrivacyModeDisables({ requestedBefore: 200 }),
    ).resolves.toEqual(['stale']);
  });
});

describe('SimpleDbEntityZcash hardware seed fingerprint', () => {
  const fingerprint = 'ab'.repeat(32);
  const meta = {
    vkFp: 'c'.repeat(32),
    unifiedAddress: 'u1',
    transparentAddress: 't1',
    seedFingerprintHex: fingerprint,
    hdIndex: 0,
    createdAt: 1,
  };

  it('keeps the wallet fingerprint through privacy-data deletion and drops it with the wallet', async () => {
    const entity = createEntity({ accounts: { 'hw-1--acc': meta } });
    await entity.saveWalletSeedFingerprint({
      walletId: 'hw-1',
      seedFingerprintHex: fingerprint.toUpperCase(),
    });
    await expect(
      entity.getWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBe(fingerprint);

    await entity.removeAccountMeta({ accountId: 'hw-1--acc' });
    await entity.removeAccountState({ accountId: 'hw-1--acc' });
    await expect(
      entity.getWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBe(fingerprint);
    await expect(entity.listWalletStateIds()).resolves.toContain('hw-1');

    await entity.removeWalletState({ walletId: 'hw-1' });
    await expect(
      entity.getWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBeUndefined();
    await expect(entity.listWalletStateIds()).resolves.not.toContain('hw-1');
  });

  it('rejects stored data with a malformed fingerprint', async () => {
    const entity = createEntity({
      accounts: {},
      walletSeedFingerprints: { 'hw-1': 'not-a-fingerprint' },
    });
    await expect(
      entity.getWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).rejects.toThrow();
  });
});

// The UFVK's only host copy is the viewing key store.
describe('SimpleDbEntityZcash viewing key ownership', () => {
  const meta = {
    vkFp: 'd'.repeat(32),
    unifiedAddress: 'u1',
    transparentAddress: 't1',
    seedFingerprintHex: '00',
    hdIndex: 0,
    birthdayHeight: 2000,
    createdAt: 1,
  };

  it('stores no viewing key in the account meta', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.saveAccountMeta({ accountId: 'account', meta });

    const raw = await entity.getRawData();
    expect(raw?.accounts.account).toEqual(meta);
    expect(JSON.stringify(raw)).not.toContain('ufvk');
  });

  it('tolerates a leftover ufvk and reads a meta without a fingerprint as missing', async () => {
    const entity = createEntity({
      accounts: {
        current: { ...meta, ufvk: 'uview1leftover' } as typeof meta,
        old: {
          ufvk: 'uview1old',
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: '00',
          hdIndex: 1,
          createdAt: 1,
        } as unknown as typeof meta,
      },
    });

    await expect(
      entity.getAccountMeta({ accountId: 'current' }),
    ).resolves.toMatchObject({ vkFp: meta.vkFp });
    await expect(
      entity.getAccountMeta({ accountId: 'old' }),
    ).resolves.toBeUndefined();
    await expect(entity.listAccountMetas()).resolves.toEqual([
      { accountId: 'current', meta: expect.objectContaining(meta) },
    ]);
    // Cleanup still reaches the unreadable record.
    await expect(entity.listCleanupAccountIds()).resolves.toEqual([
      'current',
      'old',
    ]);
  });
});
