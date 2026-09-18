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
          ufvk: 'ufvk',
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
    ufvk: 'ufvk-shared',
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
    await expect(entity.listActiveViewingKeys()).resolves.toEqual([]);
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
    await expect(entity.listActiveViewingKeys()).resolves.toEqual([]);

    await entity.completePrivacyModeEnable({ accountId: 'account' });

    await expect(
      entity.isPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(true);
    await expect(entity.listActiveViewingKeys()).resolves.toEqual([
      'ufvk-shared',
    ]);
  });

  it('persists the transparent-first preference across privacy mode lifecycle changes', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.initializePrivacyModeOff({ accountId: 'account' });
    await entity.beginPrivacyModeEnable({
      accountId: 'account',
      birthdayHeight: 2000,
    });
    await entity.completePrivacyModeEnable({ accountId: 'account' });

    await entity.setPreferTransparentForShieldedSends({
      accountId: 'account',
      enabled: true,
    });
    await entity.beginPrivacyModeDisable({
      accountId: 'account',
      resumeFromHeight: 2900,
    });
    await entity.completePrivacyModeDisable({ accountId: 'account' });

    await expect(
      entity.getPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      preferTransparentForShieldedSends: true,
    });
    await expect(
      entity.getPrivacyModeState({ accountId: 'other-account' }),
    ).resolves.toEqual({ intent: 'off' });
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

  it('deduplicates enabled aliases by UFVK', async () => {
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
      await entity.completePrivacyModeEnable({ accountId });
    }

    await expect(entity.listActiveViewingKeys()).resolves.toEqual([
      'ufvk-shared',
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

describe('SimpleDbEntityZcash transparent transaction journal', () => {
  it('does not restore a pending transaction after its account reservation was deleted', async () => {
    const entity = createEntity({ accounts: {} });
    const outpoint = { txid: '11'.repeat(32), vout: 0 };
    const reserve = {
      accountId: 'account',
      ownerId: 'owner',
      outpoints: [outpoint],
      currentHeight: 100,
      expiryHeight: 110,
    };
    const pending = {
      accountId: 'account',
      requireLiveReservation: true,
      tx: {
        ownerId: 'owner',
        rawTx: '00',
        txid: '22'.repeat(32),
        spentOutpoints: [outpoint],
        expiryHeight: 110,
        createdAt: 1,
        broadcastState: 'unknown' as const,
        broadcastAuthorized: false,
      },
    };
    await entity.reserveTransparentOutpoints(reserve);
    await entity.saveTransparentPendingTx(pending);
    await entity.removeAccountState({ accountId: 'account' });
    await expect(entity.saveTransparentPendingTx(pending)).rejects.toThrow(
      'reservation was removed or replaced',
    );
    await entity.releaseTransparentReservation({
      accountId: 'account',
      ownerId: 'owner',
    });
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([]);
    await expect(entity.listCleanupAccountIds()).resolves.toEqual([]);
    await entity.reserveTransparentOutpoints({
      ...reserve,
      ownerId: 'new-owner',
    });
    await expect(entity.saveTransparentPendingTx(pending)).rejects.toThrow(
      'reservation was removed or replaced',
    );
  });

  it('keeps inputs reserved through unknown broadcast and releases on settlement', async () => {
    const entity = createEntity({ accounts: {} });
    const outpoint = { txid: '11'.repeat(32), vout: 0 };

    await entity.reserveTransparentOutpoints({
      accountId: 'account',
      ownerId: 'attempt-1',
      outpoints: [outpoint],
      currentHeight: 3_500_000,
      expiryHeight: 3_500_010,
    });
    await expect(
      entity.reserveTransparentOutpoints({
        accountId: 'account',
        ownerId: 'attempt-2',
        outpoints: [outpoint],
        currentHeight: 3_500_000,
        expiryHeight: 3_500_010,
      }),
    ).rejects.toMatchObject({ code: 'UTXO_ALREADY_RESERVED' });

    await entity.saveTransparentPendingTx({
      accountId: 'account',
      tx: {
        ownerId: 'attempt-1',
        rawTx: '00',
        txid: '22'.repeat(32),
        spentOutpoints: [outpoint],
        expiryHeight: 3_500_010,
        createdAt: 1,
        broadcastState: 'unknown',
      },
    });
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toHaveLength(1);

    await entity.markTransparentPendingTxAccepted({
      accountId: 'account',
      txid: '22'.repeat(32),
    });
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([
      expect.objectContaining({ broadcastState: 'accepted' }),
    ]);
    await expect(
      entity.reserveTransparentOutpoints({
        accountId: 'account',
        ownerId: 'attempt-2',
        outpoints: [outpoint],
        currentHeight: 3_500_000,
        expiryHeight: 3_500_010,
      }),
    ).rejects.toMatchObject({ code: 'UTXO_ALREADY_RESERVED' });

    await entity.settleTransparentPendingTx({
      accountId: 'account',
      txid: '22'.repeat(32),
    });
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([]);
    await expect(
      entity.reserveTransparentOutpoints({
        accountId: 'account',
        ownerId: 'attempt-2',
        outpoints: [outpoint],
        currentHeight: 3_500_000,
        expiryHeight: 3_500_010,
      }),
    ).resolves.toBeUndefined();
  });

  it('expires unresolved transparent transactions by height', async () => {
    const entity = createEntity({ accounts: {} });
    const outpoint = { txid: '33'.repeat(32), vout: 1 };
    await entity.reserveTransparentOutpoints({
      accountId: 'account',
      ownerId: 'attempt',
      outpoints: [outpoint],
      currentHeight: 100,
      expiryHeight: 110,
    });
    await entity.saveTransparentPendingTx({
      accountId: 'account',
      tx: {
        ownerId: 'attempt',
        rawTx: '00',
        txid: '44'.repeat(32),
        spentOutpoints: [outpoint],
        expiryHeight: 110,
        createdAt: 1,
        broadcastState: 'accepted',
      },
    });

    await expect(
      entity.pruneExpiredTransparentState({
        accountId: 'account',
        currentHeight: 111,
      }),
    ).resolves.toEqual(['44'.repeat(32)]);
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([]);
  });

  it('keeps unresolved transparent transactions locked when the tip is unavailable', async () => {
    const entity = createEntity({ accounts: {} });
    const createdAt = 1000;
    const outpoint = { txid: '55'.repeat(32), vout: 1 };
    await entity.reserveTransparentOutpoints({
      accountId: 'account',
      ownerId: 'attempt',
      outpoints: [outpoint],
      currentHeight: 100,
      expiryHeight: 110,
    });
    await entity.saveTransparentPendingTx({
      accountId: 'account',
      tx: {
        ownerId: 'attempt',
        rawTx: '00',
        txid: '66'.repeat(32),
        spentOutpoints: [outpoint],
        expiryHeight: 110,
        createdAt,
        broadcastState: 'unknown',
      },
    });

    await expect(
      entity.pruneExpiredTransparentState({
        accountId: 'account',
      }),
    ).resolves.toEqual([]);
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toHaveLength(1);
  });

  it('prevents account aliases from reserving the same transparent outpoint', async () => {
    const entity = createEntity({ accounts: {} });
    const outpoint = { txid: '77'.repeat(32), vout: 0 };
    await entity.reserveTransparentOutpoints({
      accountId: 'alias-1',
      ownerId: 'attempt-1',
      outpoints: [outpoint],
      currentHeight: 100,
      expiryHeight: 110,
    });

    await expect(
      entity.reserveTransparentOutpoints({
        accountId: 'alias-2',
        ownerId: 'attempt-2',
        outpoints: [outpoint],
        currentHeight: 100,
        expiryHeight: 110,
      }),
    ).rejects.toMatchObject({ code: 'UTXO_ALREADY_RESERVED' });
  });
});

describe('SimpleDbEntityZcash shielded lifecycle journal', () => {
  it('keeps reservations until the runtime release path removes them', async () => {
    const entity = createEntity({ accounts: {} });
    await entity.saveShieldedReservation({
      accountId: 'account',
      reservationId: 'aa'.repeat(32),
      expiryHeight: 110,
      state: 'signed',
    });
    await expect(
      entity.listShieldedReservations({ accountId: 'account' }),
    ).resolves.toEqual([
      {
        reservationId: 'aa'.repeat(32),
        expiryHeight: 110,
        state: 'signed',
      },
    ]);

    await entity.removeShieldedReservation({
      accountId: 'account',
      reservationId: 'aa'.repeat(32),
    });
    await expect(
      entity.listShieldedReservations({ accountId: 'account' }),
    ).resolves.toEqual([]);

    await entity.saveShieldedReservation({
      accountId: 'account',
      reservationId: 'bb'.repeat(32),
      expiryHeight: 120,
      state: 'signed',
    });
    await expect(
      entity.listShieldedReservations({ accountId: 'account' }),
    ).resolves.toEqual([
      {
        reservationId: 'bb'.repeat(32),
        expiryHeight: 120,
        state: 'signed',
      },
    ]);
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
          ufvk: `key-${index}`,
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
        ufvk: 'key-0',
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
