/* cspell:ignore Ufvks */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getRuntime, withWallet } from './carrier';
import {
  canonicalizeZcashWalletAccounts,
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
}));

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'test-ufvk',
  seedFingerprintHex: 'test-seed',
  hdIndex: 0,
  birthdayHeight: 1_000_000,
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

function createRuntime({
  accountStatus,
  fullyScannedHeight,
}: {
  accountStatus: {
    birthdayHeight: number;
    chainTip: number;
    scannedToHeight: number;
    remainingBlocks: number;
    isComplete: boolean;
  };
  fullyScannedHeight: number;
}) {
  return {
    listAccounts: () => JSON.stringify(['account-uuid']),
    accountBalance: () =>
      JSON.stringify({
        chainTip: accountStatus.chainTip,
        fullyScannedHeight,
      }),
    accountSyncStatus: () => JSON.stringify(accountStatus),
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
    const pool = (spendable: number, uneconomic?: number) => ({
      spendable,
      pendingChange: 0,
      pendingSpendable: 0,
      locked: 0,
      total: spendable,
      ...(uneconomic === undefined ? {} : { uneconomic }),
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

    // A runtime without the field reads as no dust.
    const older = readBalance(rt(pool(0), pool(100_000)), 'a');
    expect(older).toMatchObject({
      shielded: '100000',
      ironwoodBalance: '100000',
    });
    expect(older.poolsDetail.ironwood).toMatchObject({
      total: '100000',
      uneconomic: '0',
    });
  });
});

describe('readSyncProgress', () => {
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

    expect(readSyncProgress(rt, 'account-uuid', account)).toEqual({
      birthdayHeight: 1_000_000,
      backfillScannedHeight: 1_500_000,
      backfillTargetHeight: 3_000_000,
      backfillProgress: 0.25,
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

    const progress = readSyncProgress(rt, 'account-uuid', account);

    expect(progress.isBackfillComplete).toBe(true);
    expect(progress.backfillProgress).toBe(1);
    expect(progress.isSyncing).toBe(false);
  });
});

describe('prepareWalletAccounts retention', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retains paused host identities without importing them and removes actual orphans', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      accountByUfvk: (ufvk: string) => JSON.stringify({ uuid: ufvk }),
      listAccounts: () => JSON.stringify(['active', 'paused', 'orphan']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest.mocked(withWallet).mockResolvedValue({ rt, accountUuid: 'active' });

    await prepareWalletAccounts([{ ...account, ufvk: 'active' }], {
      retainedUfvks: ['active', 'paused'],
    });

    expect(removeAccount).toHaveBeenCalledTimes(1);
    expect(removeAccount).toHaveBeenCalledWith('orphan');
    expect(
      jest
        .mocked(withWallet)
        .mock.calls.every(([prepared]) => prepared.ufvk === 'active'),
    ).toBe(true);
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

  it('does not register an unknown account in order to delete it', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      listAccounts: () => JSON.stringify(['someone-else']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest
      .mocked(withWallet)
      .mockRejectedValue(
        Object.assign(
          new OneKeyLocalError('zcash: account not registered in runtime'),
          { code: 'ACCOUNT_NOT_FOUND' },
        ),
      );
    jest.mocked(getRuntime).mockResolvedValue(rt);

    await expect(purgeWallet(account)).resolves.toBeUndefined();

    // Importing here would requeue every other account's scanned range.
    expect(
      jest.mocked(withWallet).mock.calls[0]?.[1]?.registerIfMissing,
    ).not.toBe(true);
    expect(removeAccount).not.toHaveBeenCalled();
  });

  it('removes the account it was asked to purge', async () => {
    const removeAccount = jest.fn(async () => undefined);
    const rt = {
      listAccounts: () => JSON.stringify(['someone-else']),
      removeAccount,
    } as unknown as Awaited<ReturnType<typeof withWallet>>['rt'];
    jest.mocked(withWallet).mockResolvedValue({ rt, accountUuid: 'uuid-1' });

    await expect(purgeWallet(account)).resolves.toBeUndefined();

    expect(removeAccount).toHaveBeenCalledWith('uuid-1');
  });

  it('propagates failures that are not a missing registration', async () => {
    jest
      .mocked(withWallet)
      .mockRejectedValue(new OneKeyLocalError('wallet is busy'));

    await expect(purgeWallet(account)).rejects.toThrow('wallet is busy');
  });
});
