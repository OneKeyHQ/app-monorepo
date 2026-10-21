import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityPrivacyChainState } from './SimpleDbEntityPrivacyChainState';

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

  // The month used to be copied onto each account at creation and backfilled
  // when provenance arrived later; it is now read from the wallet, so every
  // account of a fresh wallet recommends it whenever it was created.
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
    // The fresh-wallet month wins over a month the user picked.
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
    // A fresh wallet without its creation time recommends nothing; the
    // account's own creation time is never used instead.
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
    // A wallet not proven fresh recommends nothing.
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

    await entity.removeZcashAccountMeta({ accountId: 'account' });

    await expect(
      entity.getZcashAccountMeta({ accountId: 'account' }),
    ).resolves.toBeUndefined();
    const state = await entity.getZcashPrivacyModeState({
      accountId: 'account',
    });
    expect(state).toMatchObject({ intent: 'off', birthdayHeight: 2000 });
    // The cursor pointed into the cache this call just deleted. Leaving it
    // would make the account read as merely paused, and the UI would offer
    // "Resume" to someone who had asked to delete their privacy data.
    expect(state.resumeFromHeight).toBeUndefined();
    // The identity stays the reference for the next derivation.
    await expect(
      entity.getAccountVkFp({ networkId: ZEC, accountId: 'account' }),
    ).resolves.toBe(meta.vkFp);
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

    // The request is what a retry asks for; the scanner keeps its start.
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
    await entity.removeZcashAccountMeta({ accountId: 'account' });

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

    await entity.removeZcashAccountMeta({ accountId: 'hw-1--acc' });
    await expect(
      entity.getZcashWalletSeedFingerprint({ walletId: 'hw-1' }),
    ).resolves.toBe(SEED_FP);
    // Still named by an account record: removing it would leave that
    // account's runtime data unnameable.
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

// The UFVK's only host copy is the viewing key store.
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
    // Cleanup, the keep-set and "has data" still see it.
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
    // Not another network's.
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
    // Only cleanup of a removed account deletes it.
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
  // Re-enabling after a local data delete must not start at tip and miss
  // older funds; removing the account itself keeps nothing.
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

    await entity.removeXmrAccount({ accountId: 'account', keepBirthday: true });
    expect(await entity.getXmrAccountState({ accountId: 'account' })).toEqual({
      intent: 'off',
      birthdayHeight: 3_000_000,
      birthdaySource: 'user',
      birthdayTimestamp: 1_700_000_000_000,
    });
    await expect(
      entity.listScanDataAccountIds({ networkId: XMR }),
    ).resolves.toEqual([]);

    await entity.removeXmrAccount({ accountId: 'account' });
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
    ).resolves.toEqual({ intent: 'on', birthdayHeight: 2_900_000 });
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

  it('renews it when local data is deleted, a rescan is journaled, or on request', async () => {
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
    await expectNew();
    await entity.rotateAccountEpochs({ accountIds: ['account', 'missing'] });
    await expectNew();
    await entity.removeZcashAccountMeta({ accountId: 'account' });
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

    await entity.removeXmrAccount({ accountId: 'account', keepBirthday: true });

    const after = await epochOf(entity, 'account');
    expect(after).toMatch(/^[0-9a-f]{16}$/);
    expect(after).not.toBe(before);
  });
});
