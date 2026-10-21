import { SimpleDbEntityPrivacyChainJournal } from './SimpleDbEntityPrivacyChainJournal';

import type {
  IPrivacyChainJournalDB,
  IZcashTransparentPendingTx,
} from './SimpleDbEntityPrivacyChainJournal';

function createEntity(initial?: IPrivacyChainJournalDB) {
  let saved: unknown = initial ? { data: initial, updatedAt: 1 } : null;
  const entity = new SimpleDbEntityPrivacyChainJournal();
  const storage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  Reflect.set(entity, 'appStorage', storage);
  const readSaved = (): unknown =>
    typeof saved === 'string' ? JSON.parse(saved) : saved;
  return { entity, storage, readSaved };
}

it('ignores only expired signing reservations while retaining signed pending inputs', async () => {
  const { entity } = createEntity();
  const outpoint = { txid: '11'.repeat(32), vout: 0 };
  await entity.reserveTransparentOutpoints({
    accountId: 'account',
    ownerId: 'owner',
    outpoints: [outpoint],
    currentHeight: 100,
    expiryHeight: 110,
  });
  await expect(
    entity.listTransparentOutpointsInUse({
      accountId: 'account',
      currentHeight: 110,
    }),
  ).resolves.toEqual(new Set([`${outpoint.txid}:0`]));
  await expect(
    entity.listTransparentOutpointsInUse({
      accountId: 'account',
      currentHeight: 111,
    }),
  ).resolves.toEqual(new Set());
  await entity.saveTransparentPendingTx({
    accountId: 'account',
    requireLiveReservation: true,
    tx: {
      ownerId: 'owner',
      rawTx: '00',
      txid: '22'.repeat(32),
      spentOutpoints: [outpoint],
      expiryHeight: 110,
      createdAt: 1,
      broadcastState: 'unknown',
    },
  });
  await expect(
    entity.listTransparentOutpointsInUse({
      accountId: 'account',
      currentHeight: 111,
    }),
  ).resolves.toEqual(new Set([`${outpoint.txid}:0`]));
});

describe('privacy chain journal: zcash transparent', () => {
  it('does not restore a pending transaction after its account reservation was deleted', async () => {
    const { entity } = createEntity();
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
    await entity.removeZcashTransparentAccount({ accountId: 'account' });
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
    await expect(entity.listZcashTransparentAccountIds()).resolves.toEqual([]);
    await entity.reserveTransparentOutpoints({
      ...reserve,
      ownerId: 'new-owner',
    });
    await expect(entity.saveTransparentPendingTx(pending)).rejects.toThrow(
      'reservation was removed or replaced',
    );
  });

  it('keeps inputs reserved through unknown broadcast and releases on settlement', async () => {
    const { entity } = createEntity();
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

  it('prevents account aliases from reserving the same transparent outpoint', async () => {
    const { entity } = createEntity();
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

function pendingTx(
  overrides: Partial<IZcashTransparentPendingTx> & { txid: string },
): IZcashTransparentPendingTx {
  return {
    ownerId: `owner-${overrides.txid}`,
    rawTx: '00',
    spentOutpoints: [{ txid: overrides.txid, vout: 0 }],
    expiryHeight: 200,
    createdAt: 1,
    broadcastState: 'unknown',
    ...overrides,
  };
}

async function seedSend(
  entity: SimpleDbEntityPrivacyChainJournal,
  accountId: string,
  tx: IZcashTransparentPendingTx,
) {
  await entity.reserveTransparentOutpoints({
    accountId,
    ownerId: tx.ownerId,
    outpoints: tx.spentOutpoints,
    currentHeight: 100,
    expiryHeight: tx.expiryHeight,
  });
  await entity.saveTransparentPendingTx({
    accountId,
    tx,
    requireLiveReservation: true,
  });
}

describe('privacy chain journal: clear pending sends', () => {
  it('clears only the given account', async () => {
    const { entity } = createEntity();
    await seedSend(entity, 'mine', pendingTx({ txid: 'a1' }));
    await seedSend(entity, 'other', pendingTx({ txid: 'b1' }));
    await entity.reserveTransparentOutpoints({
      accountId: 'other',
      ownerId: 'signing',
      outpoints: [{ txid: 'b2', vout: 1 }],
      currentHeight: 100,
      expiryHeight: 200,
    });

    await entity.clearTransparentPendingSends({
      accountId: 'mine',
      expiredBeforeHeight: 300,
      scope: 'pending',
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'mine' }),
    ).resolves.toEqual([]);
    await expect(
      entity.listTransparentOutpointsInUse({ accountId: 'mine' }),
    ).resolves.toEqual(new Set());
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'other' }),
    ).resolves.toEqual([pendingTx({ txid: 'b1' })]);
    await expect(
      entity.listTransparentOutpointsInUse({ accountId: 'other' }),
    ).resolves.toEqual(new Set(['b1:0', 'b2:1']));
  });

  // An unknown outcome may have reached the node: releasing its inputs
  // could pay twice.
  it('keeps every send that can still be mined, with its input locks, accepted or unknown', async () => {
    const { entity } = createEntity();
    const accepted = pendingTx({ txid: 'accepted', expiryHeight: 300 });
    const expired = pendingTx({ txid: 'expired', expiryHeight: 150 });
    const unknown = pendingTx({ txid: 'unknown', expiryHeight: 300 });
    for (const tx of [accepted, expired, unknown]) {
      await seedSend(entity, 'account', tx);
    }
    await entity.reserveTransparentOutpoints({
      accountId: 'account',
      ownerId: 'signing',
      outpoints: [{ txid: 'bare', vout: 0 }],
      currentHeight: 100,
      expiryHeight: 300,
    });
    await entity.markTransparentPendingTxAccepted({
      accountId: 'account',
      txid: 'accepted',
    });
    await entity.markTransparentPendingTxAccepted({
      accountId: 'account',
      txid: 'expired',
    });

    await entity.clearTransparentPendingSends({
      accountId: 'account',
      expiredBeforeHeight: 151,
      scope: 'pending',
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([{ ...accepted, broadcastState: 'accepted' }, unknown]);
    // The bare signing lock goes, as BTC keeps none.
    await expect(
      entity.listTransparentOutpointsInUse({
        accountId: 'account',
        currentHeight: 100,
      }),
    ).resolves.toEqual(new Set(['accepted:0', 'unknown:0']));
    // The kept sends' reservations survive too, so a new selection is refused.
    for (const txid of ['accepted', 'unknown']) {
      await expect(
        entity.reserveTransparentOutpoints({
          accountId: 'account',
          ownerId: 'new',
          outpoints: [{ txid, vout: 0 }],
          currentHeight: 100,
          expiryHeight: 300,
        }),
      ).rejects.toMatchObject({ code: 'UTXO_ALREADY_RESERVED' });
    }
  });

  it('treats no send as expired without a known tip', async () => {
    const { entity } = createEntity();
    await seedSend(
      entity,
      'account',
      pendingTx({ txid: 'accepted', expiryHeight: 150 }),
    );
    await entity.markTransparentPendingTxAccepted({
      accountId: 'account',
      txid: 'accepted',
    });
    await seedSend(
      entity,
      'account',
      pendingTx({ txid: 'unknown', expiryHeight: 150 }),
    );

    await entity.clearTransparentPendingSends({
      accountId: 'account',
      scope: 'pending',
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toHaveLength(2);
  });
});

describe('privacy chain journal: drop expired sends', () => {
  it('drops only expired sends and locks, and keeps a live signing lock', async () => {
    const { entity } = createEntity();
    const live = pendingTx({ txid: 'live', expiryHeight: 300 });
    const expired = pendingTx({ txid: 'expired', expiryHeight: 150 });
    await seedSend(entity, 'account', live);
    await seedSend(entity, 'account', expired);
    await entity.reserveTransparentOutpoints({
      accountId: 'account',
      ownerId: 'signing',
      outpoints: [{ txid: 'bare', vout: 0 }],
      currentHeight: 100,
      expiryHeight: 300,
    });
    await entity.reserveTransparentOutpoints({
      accountId: 'account',
      ownerId: 'stale-signing',
      outpoints: [{ txid: 'stale', vout: 0 }],
      currentHeight: 100,
      expiryHeight: 140,
    });

    await entity.clearTransparentPendingSends({
      accountId: 'account',
      expiredBeforeHeight: 151,
      scope: 'expired',
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([live]);
    await expect(
      entity.listTransparentOutpointsInUse({ accountId: 'account' }),
    ).resolves.toEqual(new Set(['live:0', 'bare:0']));
  });

  it('drops nothing without a known tip', async () => {
    const { entity } = createEntity();
    await seedSend(
      entity,
      'account',
      pendingTx({ txid: 'old', expiryHeight: 1 }),
    );

    await entity.clearTransparentPendingSends({
      accountId: 'account',
      scope: 'expired',
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toHaveLength(1);
    await expect(
      entity.listTransparentOutpointsInUse({ accountId: 'account' }),
    ).resolves.toEqual(new Set(['old:0']));
  });
});

describe('privacy chain journal: record validation', () => {
  const goodTx = pendingTx({ txid: 'good' });
  const badTx = { txid: 'bad', rawTx: 42, ownerId: 'secret-owner' };

  it('quarantines a malformed record and keeps the rest readable', async () => {
    const { entity, readSaved } = createEntity({
      zcashTransparent: {
        account: {
          reservations: {
            'good:0': {
              ownerId: goodTx.ownerId,
              createdAt: 1,
              expiryHeight: 200,
            },
            'bad:0': { ownerId: 7 },
          },
          pendingTxs: { good: goodTx, bad: badTx },
        },
      },
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([goodTx]);
    await expect(
      entity.listTransparentOutpointsInUse({ accountId: 'account' }),
    ).resolves.toEqual(new Set(['good:0']));

    // Writes to the same account keep the quarantined records as they were.
    await entity.settleTransparentPendingTx({
      accountId: 'account',
      txid: 'good',
    });
    await entity.clearTransparentPendingSends({
      accountId: 'account',
      scope: 'pending',
    });
    const saved = readSaved() as { data: IPrivacyChainJournalDB };
    expect(saved.data.zcashTransparent).toEqual({
      account: {
        reservations: { 'bad:0': { ownerId: 7 } },
        pendingTxs: { bad: badTx },
      },
    });
  });

  it('writes only known fields of a valid record', async () => {
    const { entity, readSaved } = createEntity({
      zcashTransparent: {
        account: {
          reservations: {},
          pendingTxs: { good: { ...goodTx, junk: 'dropped' } },
        },
      },
      junk: { value: 'dropped' },
    } as IPrivacyChainJournalDB);

    await entity.markTransparentPendingTxAccepted({
      accountId: 'account',
      txid: 'good',
    });

    expect(readSaved()).toMatchObject({
      data: {
        zcashTransparent: {
          account: {
            pendingTxs: { good: { ...goodTx, broadcastState: 'accepted' } },
          },
        },
      },
    });
    const saved = readSaved() as { data: Record<string, unknown> };
    expect(Object.keys(saved.data)).toEqual(['zcashTransparent']);
    expect(
      (
        saved.data.zcashTransparent as Record<
          string,
          { pendingTxs: Record<string, unknown> }
        >
      ).account.pendingTxs.good,
    ).not.toHaveProperty('junk');
  });

  it('refuses writes to an unreadable account record without deleting it', async () => {
    const { entity, storage } = createEntity({
      zcashTransparent: { account: 'secret-blob', other: {} },
    });

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([]);
    await expect(
      entity.saveTransparentPendingTx({ accountId: 'account', tx: goodTx }),
    ).rejects.toThrow('transparent journal record is unreadable');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('fails a malformed container without echoing its content', async () => {
    const { entity, storage } = createEntity({
      zcashTransparent: 'secret-blob',
    } as unknown as IPrivacyChainJournalDB);

    const error = await entity.getRawData().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'simpledb: invalid persisted data (privacyChainJournal)',
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

describe('privacy chain journal: account removal', () => {
  it('removes the given accounts only', async () => {
    const { entity } = createEntity();
    await seedSend(entity, 'gone', pendingTx({ txid: 'a1' }));
    await seedSend(entity, 'kept', pendingTx({ txid: 'b1' }));
    await expect(entity.listAccountIds()).resolves.toEqual(['gone', 'kept']);

    await entity.removeAccounts({ accountIds: ['gone'] });

    await expect(entity.listAccountIds()).resolves.toEqual(['kept']);
    await expect(
      entity.listTransparentPendingTxs({ accountId: 'kept' }),
    ).resolves.toHaveLength(1);
  });

  it('clears every zcash account', async () => {
    const { entity } = createEntity();
    await seedSend(entity, 'account', pendingTx({ txid: 'a1' }));

    await entity.clearZcashTransparent();

    await expect(
      entity.listTransparentPendingTxs({ accountId: 'account' }),
    ).resolves.toEqual([]);
    await expect(entity.listAccountIds()).resolves.toEqual([]);
  });
});
