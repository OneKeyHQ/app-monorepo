import {
  canonicalizeZcashWalletAccounts,
  readBalance,
  readSyncProgress,
  rebroadcastUnmined,
} from './wallet';

import type { IZcashWalletAccount } from '../types/sdk';

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'test-ufvk',
  seedFingerprintHex: 'test-seed',
  hdIndex: 0,
  birthdayHeight: 1_000_000,
};

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

    expect(readBalance(rt, 'account-uuid')).toMatchObject({
      shielded: '300',
      transparent: '75',
      total: '375',
      pendingChange: '4',
      pendingSpendable: '6',
      orchardBalance: '100',
      ironwoodBalance: '200',
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

describe('rebroadcastUnmined', () => {
  it('uses only runtime-owned candidates across accounts and deduplicates txids', async () => {
    const broadcastTransaction = jest.fn(async (txid: string) => {
      if (txid === 'tx-rejected') {
        throw Object.assign(new Error('BROADCAST_REJECTED'), {
          code: 'BROADCAST_REJECTED',
          params: { errorCode: -26 },
        });
      }
    });
    const rt = {
      listAccounts: () => JSON.stringify(['account-a', 'account-b']),
      broadcastRetryTxids: (accountUuid: string) =>
        JSON.stringify(
          accountUuid === 'account-a'
            ? ['tx-accepted']
            : ['tx-accepted', 'tx-rejected'],
        ),
      broadcastTransaction,
    } as unknown as Parameters<typeof rebroadcastUnmined>[0];

    await expect(rebroadcastUnmined(rt)).resolves.toEqual({
      accepted: ['tx-accepted'],
      rejected: ['tx-rejected'],
    });
    expect(broadcastTransaction).toHaveBeenCalledTimes(2);
  });

  it('keeps unknown network outcomes eligible for a later runtime retry', async () => {
    const broadcastTransaction = jest.fn(async () => {
      throw Object.assign(new Error('NETWORK_ERROR'), {
        code: 'NETWORK_ERROR',
        params: { operation: 'sendTransaction' },
      });
    });
    const rt = {
      listAccounts: () => JSON.stringify(['account-a']),
      broadcastRetryTxids: () => JSON.stringify(['tx-network-unknown']),
      broadcastTransaction,
    } as unknown as Parameters<typeof rebroadcastUnmined>[0];

    await expect(rebroadcastUnmined(rt)).resolves.toEqual({
      accepted: [],
      rejected: [],
    });
    expect(broadcastTransaction).toHaveBeenCalledWith('tx-network-unknown');
  });

  it('does not infer candidates from transaction history', async () => {
    const broadcastTransaction = jest.fn(async () => {});
    const rt = {
      listAccounts: () => JSON.stringify(['account-a']),
      broadcastRetryTxids: () => JSON.stringify([]),
      transactionHistory: () =>
        JSON.stringify([{ txid: 'unowned-intent', minedHeight: null }]),
      broadcastTransaction,
    } as unknown as Parameters<typeof rebroadcastUnmined>[0];

    await expect(rebroadcastUnmined(rt)).resolves.toEqual({
      accepted: [],
      rejected: [],
    });
    expect(broadcastTransaction).not.toHaveBeenCalled();
  });
});
