/* cspell:ignore Ufvks */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { openWalletDatabase, withWallet } from './carrier';
import {
  canonicalizeZcashWalletAccounts,
  getBalance,
  getHistory,
  getSyncProgress,
  getTxDetails,
  prepareWalletAccounts,
  purgeWallet,
  readBalance,
  readHistory,
  readSyncProgress,
} from './wallet';

import type { IZcashWalletAccount } from '../types/sdk';

jest.mock('./carrier', () => ({
  ...jest.requireActual<typeof import('./carrier')>('./carrier'),
  withWallet: jest.fn(),
  getRuntime: jest.fn(),
  openWalletDatabase: jest.fn(),
}));

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'test-ufvk',
  seedFingerprintHex: 'test-seed',
  hdIndex: 0,
  birthdayHeight: 1_000_000,
  label: 'test-fp',
};

describe('getTxDetails', () => {
  afterEach(() => jest.mocked(withWallet).mockClear());

  it('preserves known output amounts and memos when the recipient address is unavailable', async () => {
    const memoBinary = { hex: 'ff'.repeat(512), hash: '11'.repeat(32) };
    const rt = {
      transactionOutputs: () =>
        JSON.stringify({
          spent: [],
          received: [],
          external: [
            {
              valueZat: 123_456_789,
              poolName: 'ironwood',
              address: null,
              memo: 'known memo',
              memoBinary,
            },
            {
              valueZat: 42,
              poolName: 'orchard',
              address: 'u1-known-recipient',
            },
          ],
        }),
      transactionDetails: () => JSON.stringify({ feeZat: 10_000 }),
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest
      .mocked(withWallet)
      .mockResolvedValueOnce({ rt, accountUuid: 'uuid-1' });

    await expect(
      getTxDetails(account, { txid: 'synthetic-tx' }),
    ).resolves.toMatchObject({
      external: [
        {
          value: '123456789',
          pool: 'ironwood',
          address: null,
          memo: 'known memo',
          memoBinary,
        },
        { value: '42', pool: 'orchard', address: 'u1-known-recipient' },
      ],
      feeZat: '10000',
    });
  });
});

describe('unregistered account reads', () => {
  afterEach(() => jest.mocked(withWallet).mockReset());

  it.each([
    ['balance', getBalance],
    ['progress', getSyncProgress],
    ['history', getHistory],
  ] as const)(
    'keeps %s unavailable without importing the account',
    async (_name, read) => {
      const error = Object.assign(new Error('ACCOUNT_NOT_FOUND'), {
        code: 'ACCOUNT_NOT_FOUND',
      });
      jest.mocked(withWallet).mockReset().mockRejectedValue(error);
      await expect(read(account)).rejects.toBe(error);
      expect(withWallet).toHaveBeenCalledTimes(1);
      expect(
        jest.mocked(withWallet).mock.calls[0][1]?.registerIfMissing,
      ).not.toBe(true);
    },
  );
});

function createRuntime({
  accountStatus,
  fullyScannedHeight,
}: {
  accountStatus: {
    birthdayHeight: number;
    chainTip: number | null;
    scannedToHeight: number | null;
    remainingBlocks: number;
    isComplete: boolean;
  };
  fullyScannedHeight: number | null;
}) {
  return {
    syncPeek: jest.fn(() =>
      JSON.stringify({ totalBlocks: accountStatus.remainingBlocks }),
    ),
    listAccounts: jest.fn(() => JSON.stringify(['account-uuid'])),
    accountBalance: jest.fn(() =>
      JSON.stringify({
        chainTip: accountStatus.chainTip,
        fullyScannedHeight,
      }),
    ),
    accountSyncStatus: jest.fn(() => JSON.stringify(accountStatus)),
  } as unknown as Parameters<typeof readSyncProgress>[0];
}

describe('readHistory self-transfers', () => {
  it('excludes change from a transfer within one shielded pool', () => {
    const rt = {
      transactionHistory: () =>
        JSON.stringify([
          {
            txid: 'self',
            minedHeight: 100,
            blockTime: 1,
            expiredUnmined: false,
            feeZat: 10_000,
            balanceDeltaZat: -10_000,
            totalSpentZat: 1_000_000_000,
            totalReceivedZat: 999_990_000,
            externalOutputCount: 0,
            isShielding: false,
            poolIds: [4],
            perPoolBalanceDeltaZat: { '4': '-10000' },
          },
        ]),
      transactionOutputs: jest.fn(() =>
        JSON.stringify({
          received: [
            { valueZat: 100_000_000, isChange: false },
            { valueZat: 899_990_000, isChange: true },
          ],
        }),
      ),
    } as unknown as Parameters<typeof readHistory>[0];
    expect(readHistory(rt, 'account-uuid')[0]).toMatchObject({
      txType: 'shielded',
      valueZat: '100000000',
      fee: '10000',
    });
    expect(rt.transactionOutputs).toHaveBeenCalledWith('account-uuid', 'self');
  });

  it('uses the destination pool delta for a cross-pool transfer without reading all change', () => {
    const rt = {
      transactionHistory: () =>
        JSON.stringify([
          {
            txid: 'cross-pool',
            minedHeight: 100,
            blockTime: 1,
            expiredUnmined: false,
            feeZat: 10_000,
            balanceDeltaZat: -10_000,
            totalSpentZat: 1_000_000_000,
            totalReceivedZat: 999_990_000,
            externalOutputCount: 0,
            isShielding: false,
            poolIds: [3, 4],
            perPoolBalanceDeltaZat: { '3': '-100010000', '4': '100000000' },
          },
        ]),
      transactionOutputs: jest.fn(),
    } as unknown as Parameters<typeof readHistory>[0];
    expect(readHistory(rt, 'account-uuid')[0]).toMatchObject({
      txType: 'shielded',
      valueZat: '100000000',
    });
    expect(rt.transactionOutputs).not.toHaveBeenCalled();
  });
});

describe('canonicalizeZcashWalletAccounts', () => {
  it('registers a shared UFVK once from its earliest birthday', () => {
    expect(
      canonicalizeZcashWalletAccounts([
        { ...account, birthdayHeight: 2_000_000 },
        { ...account, hdIndex: 99, birthdayHeight: 1_000_000 },
      ]),
    ).toEqual([{ ...account, birthdayHeight: 1_000_000 }]);
  });

  it('keeps distinct viewing keys separate', () => {
    expect(
      canonicalizeZcashWalletAccounts([
        account,
        { ...account, ufvk: 'other-ufvk', hdIndex: 1 },
      ]),
    ).toHaveLength(2);
  });
});

describe('readBalance', () => {
  it('does not turn NOT_SYNCED into a zero balance', () => {
    const rt = {
      accountBalance: () => {
        throw new OneKeyLocalError('NOT_SYNCED');
      },
    } as unknown as Parameters<typeof readBalance>[0];
    expect(() => readBalance(rt, 'account-uuid')).toThrow('NOT_SYNCED');
  });
  it('aggregates only the supported Orchard and Ironwood shielded pools', () => {
    const pool = (total: number, spendable = total) => ({
      spendable,
      pendingChange: 2,
      pendingSpendable: 3,
      locked: 0,
      total,
      uneconomic: 0,
    });
    const rt = {
      accountBalance: () =>
        JSON.stringify({
          ready: true,
          chainTip: 3_500_000,
          fullyScannedHeight: 3_500_000,
          orchard: pool(100),
          ironwood: pool(200),
          transparentRegular: pool(50),
          transparentCoinbase: pool(25, 0),
          total: 375,
        }),
    } as unknown as Parameters<typeof readBalance>[0];

    const result = readBalance(rt, 'account-uuid');
    expect(result).toMatchObject({
      isComplete: false,
      shielded: '300',
      pendingChange: '4',
      pendingSpendable: '6',
      orchardBalance: '100',
      ironwoodBalance: '200',
    });
    // Transparent columns are dropped on purpose: the public half is
    // backend-owned, so the runtime's figure would be a stale zero.
    expect(result).not.toHaveProperty('transparent');
    expect(result).not.toHaveProperty('transparentBalance');
    expect(result.poolsDetail).not.toHaveProperty('transparentRegular');
    expect(result.poolsDetail).not.toHaveProperty('transparentCoinbase');
  });

  it('shows dust change in the totals but never in spendable', () => {
    const pool = (spendable: number, uneconomic = 0) => ({
      spendable,
      pendingChange: 0,
      pendingSpendable: 0,
      locked: 0,
      total: spendable,
      uneconomic,
    });
    const rt = (orchard: object, ironwood: object) =>
      ({
        accountBalance: () =>
          JSON.stringify({
            ready: true,
            chainTip: 3_500_000,
            fullyScannedHeight: 3_500_000,
            orchard,
            ironwood,
            transparentRegular: pool(0),
            transparentCoinbase: pool(0),
            total: 0,
          }),
      }) as unknown as Parameters<typeof readBalance>[0];

    const result = readBalance(rt(pool(0, 1000), pool(100_000, 5000)), 'a');
    expect(result).toMatchObject({
      shielded: '106000',
      spendable: '100000',
      shieldedSpendable: '100000',
      orchardBalance: '1000',
      ironwoodBalance: '105000',
    });
    expect(result.poolsDetail.ironwood).toMatchObject({
      spendable: '100000',
      total: '105000',
      uneconomic: '5000',
    });
    expect(result.poolsDetail.orchard).toMatchObject({
      spendable: '0',
      total: '1000',
      uneconomic: '1000',
    });
  });
});

describe('readSyncProgress', () => {
  it.each([1099, null])(
    'reads current progress without a balance query when the scanned height is %s',
    (fullyScannedHeight) => {
      const status = {
        birthdayHeight: 1000,
        chainTip: 2000,
        scannedToHeight: 1100,
        remainingBlocks: 900,
        isComplete: false,
        fullyScannedHeight,
      };
      const rt = createRuntime({ accountStatus: status, fullyScannedHeight });

      expect(readSyncProgress(rt, 'account-uuid')).toMatchObject({
        chainTip: 2000,
        tipScannedHeight: fullyScannedHeight,
        isBackfillComplete: false,
      });
      expect(rt.accountSyncStatus).toHaveBeenCalledTimes(1);
      expect(rt.syncPeek).not.toHaveBeenCalled();
      expect(rt.listAccounts).not.toHaveBeenCalled();
      expect(rt.accountBalance).not.toHaveBeenCalled();
    },
  );

  it('uses the lightweight scan mark when only account status lacks the new field', () => {
    const rt = createRuntime({
      accountStatus: {
        birthdayHeight: 1000,
        chainTip: 2000,
        scannedToHeight: 1100,
        remainingBlocks: 900,
        isComplete: false,
      },
      fullyScannedHeight: 1099,
    });
    jest.spyOn(rt, 'syncPeek').mockReturnValue(
      JSON.stringify({
        chainTip: 2000,
        fullyScannedHeight: null,
      }),
    );

    expect(readSyncProgress(rt, 'account-uuid').tipScannedHeight).toBeNull();
    expect(rt.syncPeek).toHaveBeenCalledTimes(1);
    expect(rt.listAccounts).not.toHaveBeenCalled();
    expect(rt.accountBalance).not.toHaveBeenCalled();
  });

  it('counts disjoint scanned work while the contiguous cursor stays unchanged', () => {
    const status = {
      birthdayHeight: 1000,
      chainTip: 2000,
      scannedToHeight: 1100,
      remainingBlocks: 900,
      isComplete: false,
    };
    const first = readSyncProgress(
      createRuntime({ accountStatus: status, fullyScannedHeight: 1099 }),
      'account-uuid',
    );
    const next = readSyncProgress(
      createRuntime({
        accountStatus: { ...status, remainingBlocks: 500 },
        fullyScannedHeight: 1099,
      }),
      'account-uuid',
    );
    expect(next.backfillScannedHeight).toBe(first.backfillScannedHeight);
    expect(first.backfillProgress).toBeCloseTo(101 / 1001);
    expect(next.backfillProgress).toBeCloseTo(501 / 1001);
    expect(next.isBackfillComplete).toBe(false);
    expect(next.tipLag).toBe(first.tipLag);
  });

  it('does not show a single pending birthday block as fully scanned', () => {
    const progress = readSyncProgress(
      createRuntime({
        accountStatus: {
          birthdayHeight: 42,
          chainTip: 42,
          scannedToHeight: 42,
          remainingBlocks: 1,
          isComplete: false,
        },
        fullyScannedHeight: 41,
      }),
      'account-uuid',
    );
    expect(progress.backfillProgress).toBe(0);
    expect(progress.isBackfillComplete).toBe(false);
  });

  it.each([
    { birthdayHeight: 42, chainTip: null, remainingBlocks: 0 },
    { birthdayHeight: 42, chainTip: 41, remainingBlocks: 0 },
    { birthdayHeight: -1, chainTip: 42, remainingBlocks: 0 },
    { birthdayHeight: 42, chainTip: 100, remainingBlocks: -1 },
    { birthdayHeight: 42, chainTip: 100, remainingBlocks: 0.5 },
    {
      birthdayHeight: 0,
      chainTip: Number.MAX_SAFE_INTEGER,
      remainingBlocks: 0,
    },
  ])('keeps unknown or invalid scan coverage unavailable: %o', (status) => {
    const progress = readSyncProgress(
      createRuntime({
        accountStatus: {
          ...status,
          scannedToHeight: null,
          isComplete: true,
        },
        fullyScannedHeight: null,
      }),
      'account-uuid',
    );
    expect(progress.backfillProgress).toBeNull();
    expect(progress.isBackfillComplete).toBe(true);
  });

  it('uses account-level backfill progress when the shared DB tip is ahead', () => {
    const rt = createRuntime({
      accountStatus: {
        birthdayHeight: 1_000_000,
        chainTip: 3_000_000,
        scannedToHeight: 1_500_000,
        remainingBlocks: 1_500_000,
        isComplete: false,
      },
      fullyScannedHeight: 3_000_000,
    });

    expect(readSyncProgress(rt, 'account-uuid')).toEqual({
      birthdayHeight: 1_000_000,
      backfillScannedHeight: 1_500_000,
      backfillTargetHeight: 3_000_000,
      backfillProgress: expect.closeTo(0.25, 5),
      backfillRemainingBlocks: 1_500_000,
      isBackfillComplete: false,
      tipScannedHeight: 3_000_000,
      chainTip: 3_000_000,
      tipLag: 0,
      isTipCaughtUp: true,
      isSyncing: true,
    });
  });

  it('keeps a completed account complete when another account owns older work', () => {
    const rt = createRuntime({
      accountStatus: {
        birthdayHeight: 2_500_000,
        chainTip: 3_000_000,
        scannedToHeight: 3_000_000,
        remainingBlocks: 0,
        isComplete: true,
      },
      fullyScannedHeight: 3_000_000,
    });

    const progress = readSyncProgress(rt, 'account-uuid');

    expect(progress.isBackfillComplete).toBe(true);
    expect(progress.backfillProgress).toBe(1);
    expect(progress.isSyncing).toBe(false);
    expect(rt.accountBalance).toHaveBeenCalledTimes(1);
  });
});

describe('prepareWalletAccounts retention', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retains paused host identities by label without importing them and removes actual orphans', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      accountByUfvk: (ufvk: string) => JSON.stringify({ uuid: ufvk }),
      accountByName: (label: string) => JSON.stringify({ uuid: label }),
      listAccounts: () => JSON.stringify(['active', 'paused', 'orphan']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest.mocked(withWallet).mockResolvedValue({ rt, accountUuid: 'active' });

    await prepareWalletAccounts(
      [{ ...account, ufvk: 'active', label: 'active' }],
      { retainedLabels: ['paused'] },
    );

    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(removeAccount).toHaveBeenCalledWith('orphan');
    expect(
      jest
        .mocked(withWallet)
        .mock.calls.every(([prepared]) => prepared.ufvk === 'active'),
    ).toBe(true);
  });

  // Registered before accounts were named by label: only its key still finds it.
  it('keeps an account being prepared by its key even under an older name', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      accountByUfvk: (ufvk: string) =>
        JSON.stringify(ufvk === 'active' ? { uuid: 'legacy-uuid' } : null),
      accountByName: () => 'null',
      listAccounts: () => JSON.stringify(['legacy-uuid', 'orphan']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'legacy-uuid' });

    await prepareWalletAccounts([{ ...account, ufvk: 'active' }], {
      retainedLabels: [],
    });

    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(removeAccount).toHaveBeenCalledWith('orphan');
  });

  it('removes nothing when a label names more than one account', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      accountByUfvk: (ufvk: string) => JSON.stringify({ uuid: ufvk }),
      accountByName: () => {
        throw new OneKeyLocalError('INVALID_ACCOUNT_ID');
      },
      listAccounts: () => JSON.stringify(['active', 'twin-a', 'twin-b']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest.mocked(withWallet).mockResolvedValue({ rt, accountUuid: 'active' });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await prepareWalletAccounts([{ ...account, ufvk: 'active' }], {
      retainedLabels: ['twin'],
    });

    expect(removeAccount).not.toHaveBeenCalled();
  });

  it('does not infer ownership from an active-only registration call', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      listAccounts: () => JSON.stringify(['active', 'paused']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest.mocked(withWallet).mockResolvedValue({ rt, accountUuid: 'active' });

    await prepareWalletAccounts([{ ...account, ufvk: 'active' }]);

    expect(removeAccount).not.toHaveBeenCalled();
  });
});

describe('purgeWallet', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function runtime(found: string | null, remaining: string[]) {
    return {
      accountByName: jest.fn((label: string) =>
        JSON.stringify(found && label === 'test-fp' ? { uuid: found } : null),
      ),
      removeAccount: jest.fn(async () => undefined),
      listAccounts: () => JSON.stringify(remaining),
      closeWallet: jest.fn(),
      deleteWallet: jest.fn(async () => true),
    };
  }

  it('drops the account named by its label without its key or a registration', async () => {
    const rt = runtime('uuid-1', ['someone-else']);
    jest
      .mocked(openWalletDatabase)
      .mockResolvedValue(
        rt as unknown as Awaited<ReturnType<typeof openWalletDatabase>>,
      );

    await expect(
      purgeWallet({ network: 'main', label: 'test-fp' }),
    ).resolves.toEqual({ removed: true });

    expect(rt.removeAccount).toHaveBeenCalledWith('uuid-1');
    // Importing here would requeue every other account's scanned range.
    expect(withWallet).not.toHaveBeenCalled();
    expect(rt.deleteWallet).not.toHaveBeenCalled();
  });

  it('reports an account it cannot find under the label', async () => {
    const rt = runtime(null, ['someone-else']);
    jest
      .mocked(openWalletDatabase)
      .mockResolvedValue(
        rt as unknown as Awaited<ReturnType<typeof openWalletDatabase>>,
      );

    await expect(
      purgeWallet({ network: 'main', label: 'test-fp' }),
    ).resolves.toEqual({ removed: false });
    expect(rt.removeAccount).not.toHaveBeenCalled();
  });

  it('deletes the database after the last account', async () => {
    const rt = runtime('uuid-1', []);
    jest
      .mocked(openWalletDatabase)
      .mockResolvedValue(
        rt as unknown as Awaited<ReturnType<typeof openWalletDatabase>>,
      );

    await purgeWallet({ network: 'main', label: 'test-fp' });

    expect(rt.closeWallet).toHaveBeenCalledTimes(1);
    expect(rt.deleteWallet).toHaveBeenCalledWith('zcash-main.db');
  });

  it('propagates a failure to open the database', async () => {
    jest
      .mocked(openWalletDatabase)
      .mockRejectedValue(new OneKeyLocalError('wallet is busy'));

    await expect(
      purgeWallet({ network: 'main', label: 'test-fp' }),
    ).rejects.toThrow('wallet is busy');
  });
});
