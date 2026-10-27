import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  SimpleDbEntityPrivacyChainState,
  isSameZcashPendingRescan,
} from './SimpleDbEntityPrivacyChainState';

import type {
  IPrivacyChainStateDB,
  IZcashAccountMeta,
} from './SimpleDbEntityPrivacyChainState';

const ZEC = 'zec--0';
const XMR = 'xmr--0';
const SEED_FP = 'ab'.repeat(32);

function createEntity(initial?: IPrivacyChainStateDB) {
  let saved: unknown = initial ? { data: initial, updatedAt: 1 } : null;
  const entity = new SimpleDbEntityPrivacyChainState();
  const setItem = jest.fn(async (_key: string, value: unknown) => {
    saved = value;
  });
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem,
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}

function zcashMeta(overrides: Partial<IZcashAccountMeta> = {}) {
  return {
    vkFp: 'b'.repeat(32),
    unifiedAddress: 'u1',
    transparentAddress: 't1',
    seedFingerprintHex: SEED_FP,
    hdIndex: 0,
    birthdayHeight: 2000,
    birthdaySource: 'manual-height' as const,
    createdAt: 1,
    ...overrides,
  };
}

async function enableZcash(
  entity: SimpleDbEntityPrivacyChainState,
  accountId: string,
  meta = zcashMeta(),
) {
  await entity.beginZcashPrivacyModeEnable({
    networkId: ZEC,
    accountId,
    birthdayHeight: 2000,
  });
  await entity.saveZcashAccountMeta({ accountId, meta });
  await entity.completeZcashPrivacyModeEnable({ accountId });
}

describe('privacy chain state: durable account deletion', () => {
  it.each([ZEC, XMR])(
    '%s stops admission before cleanup and retains its request across restart',
    async (networkId) => {
      const entity = createEntity();
      const accountId = 'hd-1--delete';
      if (networkId === ZEC) await enableZcash(entity, accountId);
      else
        await entity.saveXmrEnabledAccount({
          networkId,
          accountId,
          vkFp: 'a'.repeat(32),
          birthdayHeight: 100,
        });
      const oldEpoch = await entity.getAccountEpoch({ accountId });
      const request = await entity.requestAccountDeletion({
        networkId,
        accountId,
      });
      expect(await entity.getAccountEpoch({ accountId })).not.toBe(oldEpoch);
      expect(
        await entity.requestAccountDeletion({ networkId, accountId }),
      ).toEqual(request);
      const restored = createEntity((await entity.getRawData()) ?? undefined);
      expect(await restored.listPendingAccountDeletions()).toEqual([request]);
      expect(await restored.listScanDataAccountIds({ networkId })).toEqual([
        accountId,
      ]);
      const state =
        networkId === ZEC
          ? await restored.getZcashPrivacyModeState({ accountId })
          : await restored.getXmrAccountState({ accountId });
      expect(state).toMatchObject({ intent: 'off' });

      await restored.clearAccountScanData({ accountId });
      expect(await restored.listPendingAccountDeletions()).toEqual([request]);
      await restored.completeAccountDeletion({
        ...request,
        requestId: '0'.repeat(16),
      });
      expect(await restored.listPendingAccountDeletions()).toEqual([request]);
      await restored.completeAccountDeletion(request);
      expect(await restored.listPendingAccountDeletions()).toEqual([]);
      expect(await restored.listScanDataAccountIds({ networkId })).toEqual([]);
    },
  );

  it('does not admit old or new enable work until deletion completes', async () => {
    const entity = createEntity();
    const params = {
      networkId: XMR,
      accountId: 'hd-1--delete',
      vkFp: 'a'.repeat(32),
      birthdayHeight: 100,
    };
    await entity.saveXmrEnabledAccount(params);
    const expectedState = await entity.getXmrAccountState(params);
    const request = await entity.requestAccountDeletion(params);
    await expect(
      entity.saveXmrEnabledAccount({ ...params, expectedState }),
    ).resolves.toBe(false);
    await expect(entity.saveXmrEnabledAccount(params)).rejects.toThrow(
      'deletion is pending',
    );
    await entity.clearAccountScanData(params);
    await entity.completeAccountDeletion(request);
    await expect(entity.saveXmrEnabledAccount(params)).resolves.toBe(true);
    await entity.requestAccountDeletion(params);
    await entity.completeAccountDeletion(request);
    expect(await entity.listPendingAccountDeletions()).toHaveLength(1);
  });

  it('persists a newer authorized enable without admitting scans until deletion completes', async () => {
    const entity = createEntity();
    const params = {
      networkId: XMR,
      accountId: 'hd-1--delete',
      vkFp: 'a'.repeat(32),
      birthdayHeight: 100,
    };
    await entity.saveXmrEnabledAccount(params);
    const old = await entity.getXmrAccountState(params);
    const request = await entity.requestAccountDeletion(params);
    await entity.beginAccountReenable(request);
    await expect(
      entity.saveXmrEnabledAccount({ ...params, expectedState: old }),
    ).resolves.toBe(false);
    await entity.saveXmrEnabledAccount({ ...params, birthdayHeight: 200 });
    const restored = createEntity((await entity.getRawData()) ?? undefined);
    expect(await restored.listPendingAccountDeletions()).toEqual([
      { ...request, reenabled: true },
    ]);
    expect(await restored.listXmrEnabledAccountIds(params)).toEqual([]);
    await restored.completeAccountDeletion(request);
    expect(await restored.listXmrEnabledAccountIds(params)).toEqual([
      params.accountId,
    ]);
    expect(await restored.getXmrAccountState(params)).toMatchObject({
      birthdayHeight: 200,
    });
  });

  it('does not mark a pending re-enabled alias prepared when another alias finishes', async () => {
    const entity = createEntity();
    const params = {
      networkId: XMR,
      accountId: 'hd-1--a',
      vkFp: 'a'.repeat(32),
      birthdayHeight: 100,
    };
    await entity.saveXmrEnabledAccount(params);
    await entity.saveXmrEnabledAccount({ ...params, accountId: 'hd-1--b' });
    const request = await entity.requestAccountDeletion(params);
    await entity.beginAccountReenable(request);
    await entity.saveXmrEnabledAccount(params);
    const b = await entity.getXmrAccountState({ accountId: 'hd-1--b' });
    await entity.completeXmrPreparation({
      accountId: 'hd-1--b',
      epoch: b.epoch!,
    });
    const a = await entity.getXmrAccountState(params);
    expect(a.deletionPending).toBe(true);
    expect(a.appliedEpoch).not.toBe(a.epoch);
  });

  it('a later delete cancels the queued re-enable and fences its older completion', async () => {
    const entity = createEntity();
    const params = {
      networkId: XMR,
      accountId: 'hd-1--delete',
      vkFp: 'a'.repeat(32),
      birthdayHeight: 100,
    };
    await entity.saveXmrEnabledAccount(params);
    const old = await entity.requestAccountDeletion(params);
    await entity.beginAccountReenable(old);
    await entity.saveXmrEnabledAccount(params);
    const latest = await entity.requestAccountDeletion(params);
    expect(latest.requestId).not.toBe(old.requestId);
    await entity.completeAccountDeletion(old);
    expect(await entity.listPendingAccountDeletions()).toEqual([latest]);
    expect(await entity.getXmrAccountState(params)).toMatchObject({
      intent: 'off',
    });
  });

  it('does not report acceptance or completion when persistence blocks the write', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'hd-1--delete');
    const blocked = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    await expect(
      entity.requestAccountDeletion({
        networkId: ZEC,
        accountId: 'hd-1--delete',
      }),
    ).rejects.toThrow('request could not be persisted');
    blocked.mockRestore();
    expect(await entity.listPendingAccountDeletions()).toEqual([]);
    const request = await entity.requestAccountDeletion({
      networkId: ZEC,
      accountId: 'hd-1--delete',
    });
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);
    await expect(entity.completeAccountDeletion(request)).rejects.toThrow(
      'completion could not be persisted',
    );
    await expect(entity.clearAccountScanData(request)).rejects.toThrow(
      'cleanup could not be persisted',
    );
  });

  it('rejects blocked Zcash enable intent and metadata writes', async () => {
    const entity = createEntity();
    const accountId = 'hd-1--save';
    await enableZcash(entity, accountId);
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);
    await expect(
      entity.beginZcashPrivacyModeEnable({
        networkId: ZEC,
        accountId,
        birthdayHeight: 3000,
      }),
    ).rejects.toThrow('enable request could not be persisted');
    await expect(
      entity.saveZcashAccountMeta({
        accountId,
        meta: zcashMeta({ birthdayHeight: 3000 }),
      }),
    ).rejects.toThrow('viewing metadata could not be persisted');
    await expect(
      entity.markZcashScanExcluded({ accountId, fromHeight: 2500 }),
    ).rejects.toThrow('resume request could not be persisted');
  });

  it('rejects a new birthday after deletion and acknowledges only persisted rescans', async () => {
    const entity = createEntity();
    const accountId = 'hd-1--delete';
    await enableZcash(entity, accountId);
    const repair = {
      birthdayHeight: 100,
      birthdaySource: 'manual-height' as const,
      requestedAt: 1,
    };
    const blocked = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined);
    await expect(
      entity.saveZcashPendingRescan({ accountId, repair }),
    ).rejects.toThrow('request could not be persisted');
    blocked.mockRestore();
    await entity.requestAccountDeletion({ networkId: ZEC, accountId });
    await expect(
      entity.saveZcashPendingRescan({ accountId, repair }),
    ).rejects.toThrow('unavailable for rescanning');
    await expect(
      entity.completeZcashPrivacyModeEnable({ accountId }),
    ).rejects.toThrow('operation is not pending');
  });
});

describe('privacy chain state: xmr background preparation', () => {
  const pending = {
    networkId: XMR,
    accountId: 'hd-1--xmr',
    vkFp: 'a'.repeat(32),
    birthdayHeight: 1,
    birthdayTimestamp: Date.UTC(2024, 0, 1),
    birthdaySource: 'pending-timestamp',
  };

  it('reloads saved authorization and its unresolved birthday without a pending foreground operation', async () => {
    const entity = createEntity();
    await entity.saveXmrEnabledAccount(pending);
    const restored = createEntity((await entity.getRawData()) ?? undefined);

    await expect(
      restored.listXmrEnabledAccountIds({ networkId: XMR }),
    ).resolves.toEqual([pending.accountId]);
    const expectedState = await restored.getXmrAccountState(pending);
    expect(expectedState).toMatchObject({
      intent: 'on',
      birthdayHeight: 1,
      birthdayTimestamp: pending.birthdayTimestamp,
      birthdaySource: pending.birthdaySource,
    });
    expect(expectedState.operation).toBeUndefined();
    await restored.updateXmrBirthday({
      ...pending,
      birthdayHeight: 3_000_000,
      birthdaySource: 'restore-month',
      expectedState,
    });

    await expect(restored.getXmrAccountState(pending)).resolves.toMatchObject({
      intent: 'on',
      birthdayHeight: 3_000_000,
      birthdaySource: 'restore-month',
    });
    expect(
      (await restored.getXmrAccountState(pending)).operation,
    ).toBeUndefined();
    expect(
      (await restored.getRawData())?.accounts?.[pending.accountId],
    ).toMatchObject({ vkFp: pending.vkFp });
  });

  it.each([
    'newer birthday',
    'disable',
    'delete',
    'same-value re-enable',
    'pending operation',
  ] as const)('ignores an old birthday result after %s', async (change) => {
    const entity = createEntity();
    await entity.saveXmrEnabledAccount(pending);
    const expectedState = await entity.getXmrAccountState(pending);
    if (change === 'newer birthday') {
      await entity.saveXmrEnabledAccount({
        ...pending,
        birthdayTimestamp: Date.UTC(2025, 0, 1),
      });
    } else if (change === 'disable') {
      await entity.completeXmrDisable(pending);
    } else if (change === 'delete') {
      await entity.removeAccount(pending);
    } else if (change === 'same-value re-enable') {
      await entity.removeAccount(pending);
      await entity.saveXmrEnabledAccount(pending);
    } else {
      await entity.beginXmrDisable(pending);
    }
    const before = await entity.getXmrAccountState(pending);

    await entity.updateXmrBirthday({
      ...pending,
      birthdayHeight: 3_000_000,
      birthdaySource: 'restore-month',
      expectedState,
    });

    await expect(entity.getXmrAccountState(pending)).resolves.toEqual(before);
  });

  it('retains an explicit rescan across restart and re-enable until the current request is applied', async () => {
    const entity = createEntity();
    await entity.saveXmrEnabledAccount({ ...pending, forceRescan: true });
    const old = await entity.getXmrAccountState(pending);
    const restored = createEntity((await entity.getRawData()) ?? undefined);
    await restored.saveXmrEnabledAccount(pending);
    const current = await restored.getXmrAccountState(pending);
    expect(current.forceRescan).toBe(true);
    expect(current.epoch).not.toBe(old.epoch);
    await restored.completeXmrPreparation({
      accountId: pending.accountId,
      epoch: old.epoch ?? '',
    });
    expect(
      (await restored.getXmrAccountState(pending)).appliedEpoch,
    ).toBeUndefined();
    await restored.completeXmrPreparation({
      accountId: pending.accountId,
      epoch: current.epoch ?? '',
    });
    expect(await restored.getXmrAccountState(pending)).toMatchObject({
      appliedEpoch: current.epoch,
    });
    expect(
      (await restored.getXmrAccountState(pending)).forceRescan,
    ).toBeUndefined();
  });

  it('refuses a different viewing identity without changing saved authorization', async () => {
    const entity = createEntity();
    await entity.saveXmrEnabledAccount(pending);
    const before = await entity.getXmrAccountState(pending);

    await expect(
      entity.saveXmrEnabledAccount({
        ...pending,
        vkFp: 'b'.repeat(32),
        birthdayHeight: 5,
      }),
    ).rejects.toThrow('viewing identity does not match');

    await expect(entity.getXmrAccountState(pending)).resolves.toEqual(before);
  });

  it('cannot complete an old disable journal over a newly enabled request', async () => {
    const entity = createEntity();
    await entity.saveXmrEnabledAccount(pending);
    await entity.beginXmrDisable(pending);
    const expectedState = await entity.getXmrAccountState(pending);
    await entity.saveXmrEnabledAccount(pending);
    const newer = await entity.getXmrAccountState(pending);
    await entity.completeXmrDisable({
      accountId: pending.accountId,
      expectedState,
    });
    expect(await entity.getXmrAccountState(pending)).toEqual(newer);
  });

  it('reports a blocked atomic disable save without claiming the account is off', async () => {
    const entity = createEntity();
    await entity.saveXmrEnabledAccount(pending);
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);
    await expect(entity.saveXmrDisabledAccount(pending)).rejects.toThrow(
      'configuration could not be persisted',
    );
    expect((await entity.getXmrAccountState(pending)).intent).toBe('on');
  });

  it('rejects admission when the persistence layer blocks the write', async () => {
    const entity = createEntity();
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);

    await expect(entity.saveXmrEnabledAccount(pending)).rejects.toThrow(
      'authorization could not be persisted',
    );

    await expect(entity.getXmrAccountState(pending)).resolves.toEqual({
      intent: 'off',
    });
  });
});

describe('privacy chain state: zcash account cleanup', () => {
  it('discovers and removes orphaned account state', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');

    await expect(entity.listAccountIds({ networkId: ZEC })).resolves.toEqual([
      'account',
    ]);
    await entity.removeAccount({ accountId: 'account' });

    await expect(entity.listAccountIds({ networkId: ZEC })).resolves.toEqual(
      [],
    );
  });
});

describe('privacy chain state: zcash privacy mode', () => {
  const meta = zcashMeta();

  it('stores fresh-wallet provenance atomically', async () => {
    const entity = createEntity();

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

  it('treats a missing record as off', async () => {
    const entity = createEntity();

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toEqual({ intent: 'off' });
    await expect(
      entity.isZcashPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
    await expect(
      entity.listZcashEnabledAccountIds({ networkId: ZEC }),
    ).resolves.toEqual([]);
  });

  it('recommends a fresh wallet creation month to its accounts', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'hd-1--enabled-before',
      birthdayHeight: 2000,
    });
    await entity.saveWalletCreationProvenance({
      walletId: 'hd-1',
      isFreshlyGeneratedMnemonic: true,
      createdAt: 1_700_000_000_000,
    });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'hd-1--enabled-before' }),
    ).resolves.toMatchObject({
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'hd-1--picked',
      birthdayTimestamp: 1_600_000_000_000,
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'hd-1--picked' }),
    ).resolves.toMatchObject({
      birthdayTimestamp: 1_600_000_000_000,
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });
    await entity.setRawData((data) => ({
      ...data,
      wallets: { ...data?.wallets, 'hd-3': { freshMnemonic: true } },
    }));
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'hd-3--account',
      birthdayHeight: 2000,
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'hd-3--account' }),
    ).resolves.not.toHaveProperty('birthdayMonthHint');
    await entity.saveWalletCreationProvenance({
      walletId: 'hd-2',
      isFreshlyGeneratedMnemonic: false,
      createdAt: 1_700_000_000_000,
    });
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'hd-2--imported',
      birthdayHeight: 2000,
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'hd-2--imported' }),
    ).resolves.not.toHaveProperty('birthdayMonthHint');
  });

  it('stays off through enable setup and turns on only after completion', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });

    await expect(
      entity.isZcashPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
    await entity.saveZcashAccountMeta({ accountId: 'account', meta });
    await expect(
      entity.listZcashEnabledAccountIds({ networkId: ZEC }),
    ).resolves.toEqual([]);

    await entity.completeZcashPrivacyModeEnable({ accountId: 'account' });

    await expect(
      entity.isZcashPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(true);
    await expect(
      entity.listZcashEnabledAccountIds({ networkId: ZEC }),
    ).resolves.toEqual(['account']);
  });

  it('records an imported month only when enable is explicitly requested', async () => {
    const entity = createEntity();

    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayTimestamp: 1_650_000_000_000,
    });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
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
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });

    await expect(
      entity.cancelZcashPendingEnables({ networkId: ZEC }),
    ).resolves.toEqual(['account']);
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayHeight: 2000,
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.not.toHaveProperty('operation');
  });

  it('rejects invalid birthday values before writing an enable journal', async () => {
    const entity = createEntity();

    await expect(
      entity.beginZcashPrivacyModeEnable({
        networkId: ZEC,
        accountId: 'account',
        birthdayHeight: Number.NaN,
      }),
    ).rejects.toThrow('privacy birthday height is invalid');
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toEqual({ intent: 'off' });
  });

  it('counts enabled aliases of one viewing key once', async () => {
    const entity = createEntity();
    for (const accountId of ['account-1', 'account-2']) {
      // eslint-disable-next-line no-await-in-loop
      await entity.beginZcashPrivacyModeEnable({
        networkId: ZEC,
        accountId,
        birthdayHeight: 2000,
      });
      // eslint-disable-next-line no-await-in-loop
      await entity.saveZcashAccountMeta({ accountId, meta });
      // eslint-disable-next-line no-await-in-loop
      await entity.completeZcashPrivacyModeEnable({
        accountId,
        maxEnabledAccounts: 1,
      });
    }

    await expect(
      entity.listZcashEnabledAccountIds({ networkId: ZEC }),
    ).resolves.toEqual(['account-1', 'account-2']);
  });

  it('fails closed while disabling and retains birthday and resume height', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account', meta);

    await entity.beginZcashPrivacyModeDisable({
      accountId: 'account',
      resumeFromHeight: 2900,
    });

    await expect(
      entity.isZcashPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
    await expect(
      entity.listZcashPendingDisables({ networkId: ZEC }),
    ).resolves.toEqual(['account']);
    await entity.completeZcashPrivacyModeDisable({ accountId: 'account' });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayHeight: 2000,
      resumeFromHeight: 2900,
    });
  });

  it('deletes viewing metadata without deleting the retained privacy birthday', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account', meta);
    await entity.beginZcashPrivacyModeDisable({
      accountId: 'account',
      resumeFromHeight: 2900,
    });
    await entity.completeZcashPrivacyModeDisable({ accountId: 'account' });

    await entity.clearAccountScanData({ accountId: 'account' });

    await expect(
      entity.getZcashAccountMeta({ accountId: 'account' }),
    ).resolves.toBeUndefined();
    const state = await entity.getZcashPrivacyModeState({
      accountId: 'account',
    });
    expect(state).toMatchObject({ intent: 'off', birthdayHeight: 2000 });
    // A leftover cursor would read as paused and offer "Resume" after the user deleted the data.
    expect(state.resumeFromHeight).toBeUndefined();
    // The identity goes too, so the next enable may use any derived key.
    await expect(
      entity.getAccountVkFp({ networkId: ZEC, accountId: 'account' }),
    ).resolves.toBeUndefined();
    await expect(
      entity.listScanDataAccountIds({ networkId: ZEC }),
    ).resolves.toEqual([]);
  });

  it('keeps an unresolved birthday request when local data is deleted', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayTimestamp: 1_650_000_000_000,
    });
    await entity.cancelZcashPendingEnables({ networkId: ZEC });

    await entity.clearAccountScanData({ accountId: 'account' });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayTimestamp: 1_650_000_000_000,
    });
  });

  it('drops a record with nothing to keep when local data is deleted', async () => {
    const entity = createEntity({
      accounts: {
        account: {
          networkId: ZEC,
          walletId: 'hd-1',
          epoch: '0'.repeat(16),
          scan: { intent: 'off', resumeFromHeight: 10 },
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    await entity.clearAccountScanData({ accountId: 'account' });

    await expect(entity.listAccountIds({ networkId: ZEC })).resolves.toEqual(
      [],
    );
  });

  it('keeps the requested birthday apart from the resolved one until setup saves it', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account', meta);

    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayTimestamp: 1_650_000_000_000,
      resetResumeFromHeight: true,
    });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({ birthdayTimestamp: 1_650_000_000_000 });
    expect(
      (await entity.getZcashPrivacyModeState({ accountId: 'account' }))
        .birthdayHeight,
    ).toBeUndefined();
    await expect(
      entity.getZcashAccountMeta({ accountId: 'account' }),
    ).resolves.toMatchObject({ birthdayHeight: 2000 });

    await entity.saveZcashAccountMeta({
      accountId: 'account',
      meta: {
        ...meta,
        birthdayHeight: 1800,
        birthdaySource: 'manual-month',
        birthdayTimestamp: 1_650_000_000_000,
      },
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      birthdayHeight: 1800,
      birthdaySource: 'manual-month',
      birthdayTimestamp: 1_650_000_000_000,
    });
  });
});

describe('privacy chain state: zcash setup compare-and-set', () => {
  it('refuses a setup write when the privacy state changed after it was read', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    const observed = await entity.getZcashPrivacyModeState({
      accountId: 'account',
    });
    await entity.cancelZcashPendingEnables({
      networkId: ZEC,
      accountId: 'account',
    });

    await expect(
      entity.saveZcashAccountMeta({
        accountId: 'account',
        meta: zcashMeta(),
        expectedPrivacyModeState: observed,
      }),
    ).rejects.toThrow('zcash: privacy state changed during setup');
    await expect(
      entity.getZcashAccountMeta({ accountId: 'account' }),
    ).resolves.toBeUndefined();
  });

  it('refuses a setup write for an account with no state', async () => {
    const entity = createEntity();

    await expect(
      entity.saveZcashAccountMeta({
        accountId: 'account',
        meta: zcashMeta(),
        expectedPrivacyModeState: { intent: 'off' },
      }),
    ).rejects.toThrow('zcash: privacy state changed during setup');
    await expect(
      entity.saveZcashAccountMeta({ accountId: 'account', meta: zcashMeta() }),
    ).rejects.toThrow('zcash: privacy state changed during setup');
  });

  it('accepts a setup write against the state it read', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    const observed = await entity.getZcashPrivacyModeState({
      accountId: 'account',
    });

    await entity.saveZcashAccountMeta({
      accountId: 'account',
      meta: zcashMeta(),
      expectedPrivacyModeState: observed,
    });

    await expect(
      entity.getZcashAccountMeta({ accountId: 'account' }),
    ).resolves.toEqual({ ...zcashMeta(), createdAt: expect.any(Number) });
  });

  it('refuses an address refresh over metadata a delete removed', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');
    const observed = await entity.getZcashAccountMeta({
      accountId: 'account',
    });
    await entity.clearAccountScanData({ accountId: 'account' });

    await expect(
      entity.saveZcashAccountMeta({
        accountId: 'account',
        meta: { ...zcashMeta(), unifiedAddress: 'u1-new' },
        expectedMeta: observed,
      }),
    ).rejects.toThrow('zcash: privacy state changed during setup');
    await expect(
      entity.getZcashAccountMeta({ accountId: 'account' }),
    ).resolves.toBeUndefined();
  });

  it('never switches the identity an account names', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');

    await expect(
      entity.saveZcashAccountMeta({
        accountId: 'account',
        meta: zcashMeta({ vkFp: 'c'.repeat(32) }),
      }),
    ).rejects.toThrow('zcash: viewing identity does not match this account');
    await expect(
      entity.saveZcashAccountMeta({
        accountId: 'account',
        meta: zcashMeta({ seedFingerprintHex: 'cd'.repeat(32) }),
      }),
    ).rejects.toThrow('zcash: seed fingerprint does not match this wallet');
  });
});

describe('privacy chain state: zcash targeted enable cancellation', () => {
  it('leaves another account enable untouched when one setup fails', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'failed',
      birthdayHeight: 2_000_000,
    });
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'other',
      birthdayHeight: 2_000_000,
    });

    await entity.cancelZcashPendingEnables({
      networkId: ZEC,
      accountId: 'failed',
    });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'failed' }),
    ).resolves.toMatchObject({ intent: 'off' });
    expect(
      (await entity.getZcashPrivacyModeState({ accountId: 'failed' }))
        .operation,
    ).toBeUndefined();
    expect(
      (await entity.getZcashPrivacyModeState({ accountId: 'other' })).operation
        ?.type,
    ).toBe('enable');
  });
});

describe('privacy chain state: zcash atomic enable admission', () => {
  it('rejects admission when the persistence layer blocks the final write', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    await entity.saveZcashAccountMeta({
      accountId: 'account',
      meta: zcashMeta(),
    });
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);

    await expect(
      entity.completeZcashPrivacyModeEnable({ accountId: 'account' }),
    ).rejects.toThrow('authorization could not be persisted');

    await expect(
      entity.isZcashPrivacyModeEnabled({ accountId: 'account' }),
    ).resolves.toBe(false);
  });
  it('enforces the viewing-identity limit when concurrent retries complete', async () => {
    const entity = createEntity();
    for (let index = 0; index < 6; index += 1) {
      const accountId = `account-${index}`;
      await entity.beginZcashPrivacyModeEnable({
        networkId: ZEC,
        accountId,
        birthdayHeight: 2_000_000,
      });
      await entity.saveZcashAccountMeta({
        accountId,
        meta: zcashMeta({
          vkFp: String(index).repeat(32),
          hdIndex: index,
        }),
      });
      if (index < 4)
        await entity.completeZcashPrivacyModeEnable({
          accountId,
          maxEnabledAccounts: 5,
        });
    }

    const outcomes = await Promise.allSettled(
      [4, 5].map((index) =>
        entity.completeZcashPrivacyModeEnable({
          accountId: `account-${index}`,
          maxEnabledAccounts: 5,
        }),
      ),
    );

    expect(outcomes.map(({ status }) => status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(
      await entity.listZcashEnabledAccountIds({ networkId: ZEC }),
    ).toHaveLength(5);
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'alias',
      birthdayHeight: 2_000_000,
    });
    await entity.saveZcashAccountMeta({
      accountId: 'alias',
      meta: zcashMeta({ vkFp: '0'.repeat(32) }),
    });
    await expect(
      entity.completeZcashPrivacyModeEnable({
        accountId: 'alias',
        maxEnabledAccounts: 5,
      }),
    ).resolves.toBeUndefined();
  });

  it('counts only the network being enabled', async () => {
    const entity = createEntity();
    await entity.beginXmrEnable({
      networkId: XMR,
      accountId: 'xmr-account',
      birthdayHeight: 3_000_000,
    });
    await entity.completeXmrEnable({
      accountId: 'xmr-account',
      vkFp: '9'.repeat(32),
    });
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    await entity.saveZcashAccountMeta({
      accountId: 'account',
      meta: zcashMeta(),
    });

    await expect(
      entity.completeZcashPrivacyModeEnable({
        accountId: 'account',
        maxEnabledAccounts: 1,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('privacy chain state: zcash repair journal', () => {
  it('shows the latest saved birthday while keeping runtime metadata unchanged until application', async () => {
    const entity = createEntity();
    const accountId = 'account';
    await enableZcash(entity, accountId);
    const original = await entity.getZcashAccountMeta({ accountId });
    for (const birthdayHeight of [1000, 3000, 1000]) {
      // eslint-disable-next-line no-await-in-loop
      await entity.saveZcashPendingRescan({
        accountId,
        repair: {
          birthdayHeight,
          birthdaySource: 'manual-height',
          requestedAt: birthdayHeight,
        },
      });
      // eslint-disable-next-line no-await-in-loop
      expect(
        await entity.getZcashPrivacyModeState({
          accountId,
          includePendingRescan: true,
        }),
      ).toMatchObject({ birthdayHeight });
      // eslint-disable-next-line no-await-in-loop
      expect(await entity.getZcashAccountMeta({ accountId })).toEqual(original);
    }
  });

  it.each([
    'same-account',
    'alias',
    'changed-epoch',
    'changed-date',
    'none',
  ] as const)(
    'automatic repair preserves newer user ownership (%s)',
    async (change) => {
      const entity = createEntity();
      await enableZcash(entity, 'account');
      await enableZcash(entity, 'alias');
      const meta = (await entity.getZcashAccountMeta({
        accountId: 'account',
      }))!;
      const automaticOwner = {
        meta,
        epoch: await entity.getAccountEpoch({ accountId: 'account' }),
      };
      const repair = {
        birthdayHeight: 1500,
        birthdaySource: 'automatic-recovery' as const,
        requestedAt: 1,
      };
      const user = {
        birthdayHeight: 3000,
        birthdaySource: 'manual-height' as const,
        requestedAt: 2,
      };
      if (change === 'same-account' || change === 'alias')
        await entity.saveZcashPendingRescan({
          accountId: change === 'alias' ? 'alias' : 'account',
          repair: user,
        });
      if (change === 'changed-epoch')
        await entity.rotateAccountEpochs({ accountIds: ['account'] });
      if (change === 'changed-date')
        await entity.saveZcashAccountMeta({
          accountId: 'account',
          meta: {
            ...meta,
            birthdayTimestamp: 100,
            birthdaySource: 'manual-month',
          },
        });
      expect(
        await entity.saveZcashPendingRescan({
          accountId: 'account',
          repair,
          automaticOwner,
        }),
      ).toBe(change === 'none');
      const journals = await entity.listZcashPendingRescans({ networkId: ZEC });
      if (change === 'same-account' || change === 'alias')
        expect(journals).toEqual([
          { accountId: change === 'alias' ? 'alias' : 'account', repair: user },
        ]);
      else expect(journals).toHaveLength(change === 'none' ? 1 : 0);
    },
  );

  it('persists the resume cursor independently from the original birthday', async () => {
    const entity = createEntity();
    const accountId = 'account';
    const meta = zcashMeta({
      birthdayTimestamp: 123,
      birthdaySource: 'restore-month',
    });
    await enableZcash(entity, accountId, meta);
    const original = await entity.getZcashAccountMeta({ accountId });
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId,
      birthdayHeight: 2000,
      birthdayTimestamp: 123,
    });
    await entity.markZcashScanExcluded({ accountId, fromHeight: 2500 });
    await entity.completeZcashPrivacyModeEnable({ accountId });
    const restored = createEntity((await entity.getRawData()) ?? undefined);
    expect(await restored.getZcashAccountMeta({ accountId })).toEqual(original);
    expect(
      await restored.getZcashPrivacyModeState({ accountId }),
    ).toMatchObject({
      scanExcludedFromHeight: 2500,
      birthdayHeight: 2000,
      birthdayTimestamp: 123,
    });
    expect(await restored.listZcashPendingRescans({ networkId: ZEC })).toEqual(
      [],
    );
  });

  it('does not let an old rescan completion consume a newer repair journal', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');
    const previous = {
      birthdayHeight: 2_000_000,
      birthdaySource: 'manual-height' as const,
      requestedAt: 1,
    };
    const current = { ...previous, birthdayHeight: 3_000_000, requestedAt: 2 };
    await entity.saveZcashPendingRescan({
      accountId: 'account',
      repair: current,
    });

    await entity.removeZcashPendingRescan({
      accountId: 'account',
      expectedRepair: previous,
    });

    await expect(
      entity.listZcashPendingRescans({ networkId: ZEC }),
    ).resolves.toEqual([{ accountId: 'account', repair: current }]);
  });

  // Storage drops undefined values (JSON); the comparison must not.
  it('matches a repair that carries an undefined timestamp', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');
    const repair = {
      birthdayHeight: 2_000_000,
      birthdaySource: 'automatic-recovery' as const,
      birthdayTimestamp: undefined,
      requestedAt: 1,
    };
    await entity.saveZcashPendingRescan({ accountId: 'account', repair });

    await entity.removeZcashPendingRescan({
      accountId: 'account',
      expectedRepair: repair,
    });

    await expect(
      entity.listZcashPendingRescans({ networkId: ZEC }),
    ).resolves.toEqual([]);
  });

  it('keeps an open repair alongside an enable journal and counts it as scan data', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    await entity.saveZcashAccountMeta({
      accountId: 'account',
      meta: zcashMeta(),
    });
    await entity.saveZcashPendingRescan({
      accountId: 'account',
      repair: {
        birthdayHeight: 1500,
        birthdaySource: 'manual-height',
        requestedAt: 1,
      },
    });
    await entity.cancelZcashPendingEnables({
      networkId: ZEC,
      accountId: 'account',
    });

    await expect(
      entity.listZcashPendingRescans({ networkId: ZEC }),
    ).resolves.toHaveLength(1);
    await expect(
      entity.listScanDataAccountIds({ networkId: ZEC }),
    ).resolves.toEqual(['account']);
  });
});

describe('privacy chain state: zcash interrupted operations', () => {
  async function journaled(type: 'enable' | 'disable', startedAt: number) {
    const now = jest.spyOn(Date, 'now').mockReturnValue(startedAt);
    return now;
  }

  it('cancels only enables journaled before this process started', async () => {
    const entity = createEntity();
    const now = await journaled('enable', 100);
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'stale',
      birthdayHeight: 2000,
    });
    now.mockReturnValue(300);
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'running',
      birthdayHeight: 2000,
    });
    now.mockRestore();

    await expect(
      entity.cancelZcashPendingEnables({
        networkId: ZEC,
        requestedBefore: 200,
      }),
    ).resolves.toEqual(['stale']);
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'running' }),
    ).resolves.toMatchObject({ operation: { type: 'enable' } });
  });

  it('lists only disables journaled before this process started', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'stale');
    await enableZcash(entity, 'running');
    const now = await journaled('disable', 100);
    await entity.beginZcashPrivacyModeDisable({
      accountId: 'stale',
      resumeFromHeight: 2000,
    });
    now.mockReturnValue(300);
    await entity.beginZcashPrivacyModeDisable({
      accountId: 'running',
      resumeFromHeight: 2000,
    });
    now.mockRestore();

    await expect(
      entity.listZcashPendingDisables({
        networkId: ZEC,
        requestedBefore: 200,
      }),
    ).resolves.toEqual(['stale']);
  });

  it('never settles another chain journal', async () => {
    const entity = createEntity();
    await entity.beginXmrEnable({
      networkId: XMR,
      accountId: 'xmr-account',
      birthdayHeight: 3_000_000,
    });
    await entity.beginXmrDisable({ accountId: 'xmr-account' });

    await expect(
      entity.cancelZcashPendingEnables({ networkId: ZEC }),
    ).resolves.toEqual([]);
    await expect(
      entity.listZcashPendingDisables({ networkId: ZEC }),
    ).resolves.toEqual([]);
    await expect(
      entity.listXmrPendingOperations({ networkId: XMR }),
    ).resolves.toHaveLength(1);
  });
});

describe('privacy chain state: zcash hardware seed fingerprint', () => {
  it('keeps the wallet fingerprint through privacy-data deletion and drops it with the wallet', async () => {
    const entity = createEntity();
    await entity.saveZcashWalletSeedFingerprint({
      walletId: 'hw-1',
      seedFingerprintHex: SEED_FP.toUpperCase(),
    });
    await expect(
      entity.getZcashWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBe(SEED_FP);
    await enableZcash(entity, 'hw-1--acc');

    await entity.clearAccountScanData({ accountId: 'hw-1--acc' });
    await expect(
      entity.getZcashWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBe(SEED_FP);
    await entity.removeWalletState({ walletId: 'hw-1' });
    await expect(entity.listWalletStateIds()).resolves.toContain('hw-1');

    await entity.removeAccount({ accountId: 'hw-1--acc' });
    await entity.removeWalletState({ walletId: 'hw-1' });
    await expect(
      entity.getZcashWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBeUndefined();
    await expect(entity.listWalletStateIds()).resolves.not.toContain('hw-1');
  });

  it('reads a malformed fingerprint as missing and refuses to write one', async () => {
    const entity = createEntity({
      wallets: {
        'hw-1': { chain: { zcash: { seedFingerprintHex: 'not-hex' } } },
        'hw-2': { chain: { zcash: { seedFingerprintHex: SEED_FP } } },
      },
    });
    await expect(
      entity.getZcashWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBeUndefined();
    await expect(
      entity.getZcashWalletSeedFingerprint({ walletId: 'hw-2' }),
    ).resolves.toBe(SEED_FP);
    await expect(
      entity.saveZcashWalletSeedFingerprint({
        walletId: 'hw-3',
        seedFingerprintHex: 'not-hex',
      }),
    ).rejects.toThrow('privacy chain: invalid wallet state');
    await expect(entity.listWalletStateIds()).resolves.toEqual([
      'hw-1',
      'hw-2',
    ]);
  });
});

describe('privacy chain state: zcash viewing key ownership', () => {
  it('stores no viewing key, and the seed fingerprint once per wallet', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'hd-1--account');

    const raw = await entity.getRawData();
    expect(JSON.stringify(raw)).not.toContain('ufvk');
    expect(raw?.accounts?.['hd-1--account']).toMatchObject({
      networkId: ZEC,
      walletId: 'hd-1',
      vkFp: 'b'.repeat(32),
      scan: {
        intent: 'on',
        birthday: { height: 2000, source: 'manual-height' },
      },
      chain: {
        zcash: { unifiedAddress: 'u1', transparentAddress: 't1', hdIndex: 0 },
      },
    });
    expect(raw?.wallets?.['hd-1']).toEqual({
      chain: { zcash: { seedFingerprintHex: SEED_FP } },
    });
  });
});

describe('privacy chain state: per-record validation', () => {
  const good = {
    networkId: ZEC,
    walletId: 'hd-1',
    vkFp: 'b'.repeat(32),
    epoch: '0123456789abcdef',
    scan: { intent: 'on', birthday: { height: 2000 } },
    chain: {
      zcash: { unifiedAddress: 'u1', transparentAddress: 't1', hdIndex: 0 },
    },
    createdAt: 1,
    updatedAt: 1,
  };

  it('reads a malformed record as not enabled and keeps the others working', async () => {
    const entity = createEntity({
      wallets: {
        'hd-1': { chain: { zcash: { seedFingerprintHex: SEED_FP } } },
      },
      accounts: {
        good,
        bad: { networkId: ZEC, scan: { intent: 'sideways' } },
      },
    });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'bad' }),
    ).resolves.toEqual({ intent: 'off' });
    await expect(
      entity.listZcashEnabledAccountIds({ networkId: ZEC }),
    ).resolves.toEqual(['good']);
    await expect(
      entity.getZcashAccountMeta({ accountId: 'good' }),
    ).resolves.toMatchObject({ vkFp: 'b'.repeat(32) });
    await expect(entity.listAccountIds({ networkId: ZEC })).resolves.toEqual([
      'good',
      'bad',
    ]);
    await expect(
      entity.listScanDataAccountIds({ networkId: ZEC }),
    ).resolves.toEqual(['good', 'bad']);
    await expect(
      entity.listZcashMetaAccountIds({ networkId: ZEC }),
    ).resolves.toEqual(['good', 'bad']);
    await expect(entity.listAccountIds({ networkId: XMR })).resolves.toEqual(
      [],
    );
  });

  it('counts a malformed record with no network under every network', async () => {
    const entity = createEntity({ accounts: { bad: 'garbage' } });

    await expect(entity.listAccountIds({ networkId: ZEC })).resolves.toEqual([
      'bad',
    ]);
    await expect(
      entity.listScanDataAccountIds({ networkId: XMR }),
    ).resolves.toEqual(['bad']);
    await entity.removeNetworkAccounts({ networkId: ZEC });
    await expect(entity.listAccountIds({ networkId: XMR })).resolves.toEqual([
      'bad',
    ]);
  });

  it('keeps a malformed record through writes to other accounts, and an enable replaces it', async () => {
    const bad = { networkId: ZEC, scan: { intent: 'sideways' } };
    const entity = createEntity({ accounts: { bad } });

    await enableZcash(entity, 'other');
    await expect(entity.getRawData()).resolves.toMatchObject({
      accounts: { bad },
    });

    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'bad',
      birthdayHeight: 2000,
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'bad' }),
    ).resolves.toMatchObject({
      intent: 'off',
      birthdayHeight: 2000,
      operation: { type: 'enable' },
    });
  });

  it('writes known fields only', async () => {
    const entity = createEntity({
      futureField: 'dropped',
      wallets: {
        'hd-1': {
          chain: { zcash: { seedFingerprintHex: SEED_FP } },
          leftover: 1,
        },
      },
      accounts: { good: { ...good, ufvk: 'uview1leftover' } },
    } as IPrivacyChainStateDB);

    await entity.markZcashScanExcluded({ accountId: 'good', fromHeight: 2100 });
    await entity.saveWalletCreationProvenance({
      walletId: 'hd-1',
      isFreshlyGeneratedMnemonic: false,
      createdAt: 1,
    });

    const raw = await entity.getRawData();
    expect(raw).not.toHaveProperty('futureField');
    expect(JSON.stringify(raw)).not.toContain('uview1leftover');
    expect(raw?.wallets?.['hd-1']).not.toHaveProperty('leftover');
    await expect(
      entity.getZcashPrivacyModeState({ accountId: 'good' }),
    ).resolves.toMatchObject({ scanExcludedFromHeight: 2100 });
  });

  it('refuses to write a record that would not read back', async () => {
    const entity = createEntity();

    await expect(
      entity.beginXmrEnable({
        networkId: XMR,
        accountId: 'account',
        birthdayHeight: Number.NaN,
      }),
    ).rejects.toThrow('privacy chain: invalid account state');
    await expect(entity.listAccountIds({ networkId: XMR })).resolves.toEqual(
      [],
    );
  });

  it('says nothing was read when the state is absent or masked', async () => {
    const entity = createEntity();

    await expect(
      entity.listScanDataAccountIds({ networkId: ZEC }),
    ).resolves.toBeUndefined();
  });
});

describe('privacy chain state: container', () => {
  it.each([
    '{"private-fragment":',
    'null',
    '42',
    '[]',
    '{"data":null,"updatedAt":1}',
    '{"data":{"accounts":[]},"updatedAt":1}',
    '{"data":{"wallets":"x"},"updatedAt":1}',
    '{"data":{"pendingLocalDataDrop":{}},"updatedAt":1}',
    '{"data":{"runtimeOrphans":"zec--0"},"updatedAt":1}',
  ])('preserves malformed data and refuses a builder write', async (saved) => {
    const entity = new SimpleDbEntityPrivacyChainState();
    const getItem = jest.fn(async () => saved);
    const setItem = jest.fn();
    const removeItem = jest.fn();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    Reflect.set(entity, 'appStorage', { getItem, setItem, removeItem });
    const builder = jest.fn(() => ({ accounts: {} }));
    try {
      await expect(entity.getRawData()).rejects.toThrow(
        'simpledb: invalid persisted data (privacyChainState)',
      );
      await expect(entity.setRawData(builder)).rejects.toThrow(
        'simpledb: invalid persisted data (privacyChainState)',
      );
      expect(builder).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retains the record when the storage backend cannot read its blob', async () => {
    const entity = new SimpleDbEntityPrivacyChainState();
    const error = new Error('Failed to read large IndexedDB value');
    error.name = 'UnknownError';
    const getItem = jest.fn(async () => {
      throw error;
    });
    const removeItem = jest.fn();
    Reflect.set(entity, 'appStorage', { getItem, removeItem });
    await expect(entity.getRawData()).rejects.toBe(error);
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('refuses a pending drop list it cannot read as network ids', async () => {
    const entity = createEntity({
      pendingLocalDataDrop: ['zec--0', 42] as unknown as string[],
    });

    await expect(entity.getPendingLocalDataDrop()).rejects.toThrow(
      OneKeyLocalError,
    );
  });
});

describe('privacy chain state: device', () => {
  it('removes only the networks that were wiped', async () => {
    const entity = createEntity({
      pendingLocalDataDrop: ['zec--0', 'xmr--0'],
      device: { allowCellularSync: true },
    });

    await entity.removePendingLocalDataDrop({ networkIds: ['zec--0'] });

    await expect(entity.getPendingLocalDataDrop()).resolves.toEqual(['xmr--0']);
    await expect(entity.getAllowCellularSync()).resolves.toBe(true);
  });

  it('keeps a network marked after the retry read the list', async () => {
    const entity = createEntity({ pendingLocalDataDrop: ['xmr--0'] });

    await entity.removePendingLocalDataDrop({ networkIds: ['zec--0'] });

    await expect(entity.getPendingLocalDataDrop()).resolves.toEqual(['xmr--0']);
  });

  it('defaults cellular sync to not allowed', async () => {
    const entity = createEntity();

    await expect(entity.getAllowCellularSync()).resolves.toBe(false);
    await entity.setAllowCellularSync({ allow: true });
    await expect(entity.getAllowCellularSync()).resolves.toBe(true);
  });
});

describe('privacy chain state: monero', () => {
  it('rejects a blocked legacy enable journal before it can be admitted', async () => {
    const entity = createEntity();
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);

    await expect(
      entity.beginXmrEnable({
        networkId: XMR,
        accountId: 'account',
        birthdayHeight: 3_000_000,
      }),
    ).rejects.toThrow('authorization could not be persisted');

    await expect(
      entity.getXmrAccountState({ accountId: 'account' }),
    ).resolves.toEqual({ intent: 'off' });
  });

  it('rejects a blocked final legacy enable commit', async () => {
    const entity = createEntity();
    await entity.beginXmrEnable({
      networkId: XMR,
      accountId: 'account',
      birthdayHeight: 3_000_000,
    });
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);

    await expect(
      entity.completeXmrEnable({ accountId: 'account', vkFp: '9'.repeat(32) }),
    ).rejects.toThrow('authorization could not be persisted');

    await expect(
      entity.listXmrEnabledAccountIds({ networkId: XMR }),
    ).resolves.toEqual([]);
  });

  it.each(['deleted', 'disabling'] as const)(
    'rejects a late enable completion after the account is %s',
    async (change) => {
      const entity = createEntity();
      await entity.beginXmrEnable({
        networkId: XMR,
        accountId: 'account',
        birthdayHeight: 3_000_000,
      });
      if (change === 'deleted') {
        await entity.removeAccount({ accountId: 'account' });
      } else {
        await entity.beginXmrDisable({ accountId: 'account' });
      }

      await expect(
        entity.completeXmrEnable({
          accountId: 'account',
          vkFp: '9'.repeat(32),
        }),
      ).rejects.toThrow('enable operation is not pending');

      await expect(
        entity.listXmrEnabledAccountIds({ networkId: XMR }),
      ).resolves.toEqual([]);
    },
  );

  // Re-enabling after a local data delete must not start at tip and miss older funds.
  it('keeps only the birthday when local data is deleted', async () => {
    const entity = createEntity();
    await entity.beginXmrEnable({
      networkId: XMR,
      accountId: 'account',
      birthdayHeight: 3_000_000,
      birthdaySource: 'user',
      birthdayTimestamp: 1_700_000_000_000,
    });
    await entity.completeXmrEnable({
      accountId: 'account',
      vkFp: '9'.repeat(32),
    });
    await entity.beginXmrDisable({
      accountId: 'account',
      resumeFromHeight: 3_100_000,
    });
    await entity.completeXmrDisable({ accountId: 'account' });

    await entity.clearAccountScanData({ accountId: 'account' });
    expect(await entity.getXmrAccountState({ accountId: 'account' })).toEqual({
      epoch: expect.any(String),
      intent: 'off',
      birthdayHeight: 3_000_000,
      birthdaySource: 'user',
      birthdayTimestamp: 1_700_000_000_000,
    });
    await expect(
      entity.listScanDataAccountIds({ networkId: XMR }),
    ).resolves.toEqual([]);
    await expect(
      entity.getAccountVkFp({ networkId: XMR, accountId: 'account' }),
    ).resolves.toBeUndefined();

    await entity.removeAccount({ accountId: 'account' });
    await expect(entity.listAccountIds({ networkId: XMR })).resolves.toEqual(
      [],
    );
  });

  it('journals an enable as on, then settles it with the runtime birthday', async () => {
    const entity = createEntity();
    await entity.beginXmrEnable({
      networkId: XMR,
      accountId: 'account',
      birthdayHeight: 3_000_000,
    });
    await expect(
      entity.getXmrAccountState({ accountId: 'account' }),
    ).resolves.toMatchObject({
      intent: 'on',
      operation: { type: 'enable' },
    });
    await expect(
      entity.listXmrEnabledAccountIds({ networkId: XMR }),
    ).resolves.toEqual([]);

    await entity.completeXmrEnable({
      accountId: 'account',
      birthdayHeight: 2_900_000,
      vkFp: '9'.repeat(32),
    });

    await expect(
      entity.getXmrAccountState({ accountId: 'account' }),
    ).resolves.toMatchObject({ intent: 'on', birthdayHeight: 2_900_000 });
    await expect(
      entity.listXmrEnabledAccountIds({ networkId: XMR }),
    ).resolves.toEqual(['account']);
    await expect(
      entity.getAccountVkFp({ networkId: XMR, accountId: 'account' }),
    ).resolves.toBe('9'.repeat(32));
    await expect(
      entity.completeXmrEnable({ accountId: 'account', vkFp: '8'.repeat(32) }),
    ).rejects.toThrow('xmr: viewing identity does not match this account');
  });

  it('does not create state when a never-enabled account is turned off', async () => {
    const entity = createEntity();

    await entity.beginXmrDisable({
      accountId: 'account',
      resumeFromHeight: 1,
    });
    await entity.completeXmrDisable({ accountId: 'account' });

    await expect(entity.listAccountIds({ networkId: XMR })).resolves.toEqual(
      [],
    );
  });
});

describe('privacy chain state: epoch', () => {
  async function epochOf(
    entity: SimpleDbEntityPrivacyChainState,
    accountId: string,
  ) {
    return entity.getAccountEpoch({ accountId });
  }

  it('starts with a random 64-bit epoch and keeps it through ordinary writes', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    const created = await epochOf(entity, 'account');
    expect(created).toMatch(/^[0-9a-f]{16}$/);

    await entity.saveZcashAccountMeta({
      accountId: 'account',
      meta: zcashMeta(),
    });
    await entity.completeZcashPrivacyModeEnable({ accountId: 'account' });
    await entity.beginZcashPrivacyModeDisable({
      accountId: 'account',
      resumeFromHeight: 2100,
    });
    await entity.completeZcashPrivacyModeDisable({ accountId: 'account' });

    await expect(epochOf(entity, 'account')).resolves.toBe(created);
  });

  it('renews it when local data is deleted or on request, not when a rescan is journaled', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');
    const seen = new Set([await epochOf(entity, 'account')]);
    const expectNew = async () => {
      const epoch = await epochOf(entity, 'account');
      expect(seen.has(epoch)).toBe(false);
      seen.add(epoch);
    };

    await entity.saveZcashPendingRescan({
      accountId: 'account',
      repair: {
        birthdayHeight: 1900,
        birthdaySource: 'manual-height',
        requestedAt: 1,
      },
    });
    await expect(epochOf(entity, 'account')).resolves.toBe(
      [...seen][seen.size - 1],
    );
    await entity.rotateAccountEpochs({ accountIds: ['account', 'missing'] });
    await expectNew();
    await entity.clearAccountScanData({ accountId: 'account' });
    await expectNew();
    await expect(epochOf(entity, 'missing')).resolves.toBeUndefined();
  });

  it('renews it when Monero local data is deleted', async () => {
    const entity = createEntity();
    await entity.beginXmrEnable({
      networkId: XMR,
      accountId: 'account',
      birthdayHeight: 3_000_000,
    });
    const before = await epochOf(entity, 'account');

    await entity.clearAccountScanData({ accountId: 'account' });

    const after = await epochOf(entity, 'account');
    expect(after).toMatch(/^[0-9a-f]{16}$/);
    expect(after).not.toBe(before);
  });
});

describe('privacy chain state: epoch mirror', () => {
  function createControlledEntity(initial?: IPrivacyChainStateDB) {
    let saved: unknown = initial ? { data: initial, updatedAt: 1 } : null;
    let holdReads = false;
    let holdWrites = false;
    const pendingReads: (() => void)[] = [];
    const pendingWrites: (() => void)[] = [];
    const entity = new SimpleDbEntityPrivacyChainState();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: jest.fn(async () => {
        if (holdReads) {
          await new Promise<void>((resolve) => pendingReads.push(resolve));
        }
        return saved;
      }),
      setItem: jest.fn(async (_key: string, value: unknown) => {
        if (holdWrites) {
          await new Promise<void>((resolve) => pendingWrites.push(resolve));
        }
        saved = value;
      }),
      removeItem: jest.fn(async () => {
        saved = null;
      }),
    };
    return {
      entity,
      setSaved: (data: IPrivacyChainStateDB) => {
        saved = { data, updatedAt: 2 };
      },
      holdReads: (hold: boolean) => {
        holdReads = hold;
      },
      holdWrites: (hold: boolean) => {
        holdWrites = hold;
      },
      releaseReads: () => pendingReads.splice(0).forEach((fn) => fn()),
      releaseWrites: () => pendingWrites.splice(0).forEach((fn) => fn()),
    };
  }

  const record = (epoch: string) => ({
    networkId: XMR,
    walletId: 'hd-1',
    epoch,
    scan: { intent: 'on' as const, birthday: { height: 1 } },
    createdAt: 1,
    updatedAt: 1,
  });

  it('moves the epoch before a rotation is persisted', async () => {
    const harness = createControlledEntity({
      accounts: { account: record('1'.repeat(16)) },
    });
    const { entity } = harness;
    const before = await entity.getAccountEpoch({ accountId: 'account' });
    expect(before).toBe('1'.repeat(16));

    harness.holdWrites(true);
    const rotation = entity.rotateAccountEpochs({ accountIds: ['account'] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const during = await entity.getAccountEpoch({ accountId: 'account' });
    expect(during).toMatch(/^[0-9a-f]{16}$/);
    expect(during).not.toBe(before);

    harness.holdWrites(false);
    harness.releaseWrites();
    await rotation;
    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBe(during);
  });

  it('answers a read overtaken by a rotation with the rotated epoch', async () => {
    const harness = createControlledEntity({
      accounts: { account: record('1'.repeat(16)) },
    });
    const { entity } = harness;
    harness.holdReads(true);
    const read = entity.getAccountEpoch({ accountId: 'account' });
    const rotation = entity.rotateAccountEpochs({ accountIds: ['account'] });
    harness.holdReads(false);
    harness.releaseReads();
    const [epoch] = await Promise.all([read, rotation]);

    expect(epoch).not.toBe('1'.repeat(16));
    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBe(epoch);
  });

  it('does not remember an empty (or masked) read', async () => {
    const harness = createControlledEntity();
    const { entity } = harness;
    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBeUndefined();

    harness.setSaved({ accounts: { account: record('2'.repeat(16)) } });

    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBe('2'.repeat(16));
  });

  it('reads disk again once the remembered epochs are forgotten', async () => {
    const harness = createControlledEntity({
      accounts: { account: record('1'.repeat(16)) },
    });
    const { entity } = harness;
    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBe('1'.repeat(16));
    harness.setSaved({ accounts: { account: record('3'.repeat(16)) } });
    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBe('1'.repeat(16));

    await entity.forgetAccountEpochs();

    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBe('3'.repeat(16));
  });

  it('follows record removal', async () => {
    const harness = createControlledEntity({
      accounts: { account: record('1'.repeat(16)) },
    });
    const { entity } = harness;
    await entity.getAccountEpoch({ accountId: 'account' });

    await entity.removeAccount({ accountId: 'account' });

    await expect(
      entity.getAccountEpoch({ accountId: 'account' }),
    ).resolves.toBeUndefined();
  });
});

describe('privacy chain state: runtime orphan marker', () => {
  it('marks, reports and clears one network at a time', async () => {
    const entity = createEntity();
    await expect(entity.hasRuntimeOrphans({ networkId: ZEC })).resolves.toBe(
      false,
    );

    await entity.markRuntimeOrphans({ networkId: ZEC });
    await entity.markRuntimeOrphans({ networkId: ZEC });
    await entity.markRuntimeOrphans({ networkId: XMR });
    await expect(entity.hasRuntimeOrphans({ networkId: ZEC })).resolves.toBe(
      true,
    );

    await entity.clearRuntimeOrphans({ networkId: ZEC });
    await expect(entity.hasRuntimeOrphans({ networkId: ZEC })).resolves.toBe(
      false,
    );
    await expect(entity.hasRuntimeOrphans({ networkId: XMR })).resolves.toBe(
      true,
    );
  });

  it('keeps the marker through unrelated writes', async () => {
    const entity = createEntity();
    await entity.markRuntimeOrphans({ networkId: ZEC });

    await entity.setAllowCellularSync({ allow: true });
    await entity.removeAccount({ accountId: 'whatever' });

    await expect(entity.hasRuntimeOrphans({ networkId: ZEC })).resolves.toBe(
      true,
    );
  });
});

describe('privacy chain state: A5 review follow-ups', () => {
  // A height repair carries `birthdayTimestamp: undefined`; the stored one
  // has no such key.
  it('matches a repair whatever undefined keys it carries', async () => {
    const entity = createEntity();
    await enableZcash(entity, 'account');
    const repair = {
      birthdayHeight: 1900,
      birthdaySource: 'manual-height' as const,
      birthdayTimestamp: undefined,
      requestedAt: 1,
    };
    await entity.saveZcashPendingRescan({ accountId: 'account', repair });
    const [stored] = await entity.listZcashPendingRescans({ networkId: ZEC });
    expect(isSameZcashPendingRescan(stored.repair, repair)).toBe(true);
    expect(
      isSameZcashPendingRescan(stored.repair, { ...repair, requestedAt: 2 }),
    ).toBe(false);

    await entity.removeZcashPendingRescan({
      accountId: 'account',
      expectedRepair: repair,
    });
    await expect(
      entity.listZcashPendingRescans({ networkId: ZEC }),
    ).resolves.toEqual([]);
  });

  it('recommends the creation month to a never-enabled account of a fresh wallet', async () => {
    const entity = createEntity();
    await entity.saveWalletCreationProvenance({
      walletId: 'hd-1',
      isFreshlyGeneratedMnemonic: true,
      createdAt: 1_700_000_000_000,
    });

    await expect(
      entity.getZcashPrivacyModeState({ accountId: "hd-1--m/44'/133'/0'" }),
    ).resolves.toEqual({
      intent: 'off',
      birthdayMonthHint: {
        timestamp: 1_700_000_000_000,
        source: 'created-wallet',
      },
    });
    await expect(
      entity.getZcashPrivacyModeState({ accountId: "hd-2--m/44'/133'/0'" }),
    ).resolves.toEqual({ intent: 'off' });
  });

  it('accepts a setup write when only an epoch rotation happened meanwhile', async () => {
    const entity = createEntity();
    await entity.beginZcashPrivacyModeEnable({
      networkId: ZEC,
      accountId: 'account',
      birthdayHeight: 2000,
    });
    const observed = await entity.getZcashPrivacyModeState({
      accountId: 'account',
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await entity.rotateAccountEpochs({ accountIds: ['account'] });

    await expect(
      entity.saveZcashAccountMeta({
        accountId: 'account',
        meta: zcashMeta(),
        expectedPrivacyModeState: observed,
      }),
    ).resolves.toBeUndefined();
  });
});
