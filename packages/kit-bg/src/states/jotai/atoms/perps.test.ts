import {
  type IPerpsAccountDisplaySnapshotAtom,
  type IPerpsAccountDisplaySnapshotEntry,
  getPerpsAccountDisplaySnapshotEntry,
} from './perps';

const now = 1_000_000;

function buildEntry({
  accountAddress,
  accountId = 'account-1',
  indexedAccountId = 'indexed-1',
  deriveType = 'default',
  updatedAt = now,
}: {
  accountAddress: `0x${string}`;
  accountId?: string | null;
  indexedAccountId?: string | null;
  deriveType?: IPerpsAccountDisplaySnapshotEntry['account']['deriveType'];
  updatedAt?: number;
}): IPerpsAccountDisplaySnapshotEntry {
  return {
    account: {
      accountAddress,
      accountId,
      indexedAccountId,
      deriveType,
    },
    accountValue: `${accountAddress}-value`,
    withdrawable: '100',
    availableToTrade: {
      coin: 'BTC',
      value: '10',
      updatedAt,
    },
    updatedAt,
  };
}

describe('getPerpsAccountDisplaySnapshotEntry', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not fall back to the latest account snapshot without an account match', () => {
    const snapshot: IPerpsAccountDisplaySnapshotAtom = {
      entries: {
        '0xabc': buildEntry({ accountAddress: '0xabc' }),
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
      }),
    ).toBeUndefined();
  });

  it('does not match the same indexed account with a different derive type', () => {
    const snapshot: IPerpsAccountDisplaySnapshotAtom = {
      entries: {
        '0xabc': buildEntry({
          accountAddress: '0xabc',
          indexedAccountId: 'indexed-1',
          deriveType: 'ledgerLive',
        }),
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
        indexedAccountId: 'indexed-1',
        deriveType: 'default',
      }),
    ).toBeUndefined();
  });

  it('does not match the same derive type with a different indexed account', () => {
    const snapshot: IPerpsAccountDisplaySnapshotAtom = {
      entries: {
        '0xabc': buildEntry({
          accountAddress: '0xabc',
          indexedAccountId: 'indexed-1',
          deriveType: 'default',
        }),
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
        indexedAccountId: 'indexed-2',
        deriveType: 'default',
      }),
    ).toBeUndefined();
  });

  it('does not return expired entries', () => {
    const snapshot: IPerpsAccountDisplaySnapshotAtom = {
      entries: {
        '0xabc': buildEntry({
          accountAddress: '0xabc',
          updatedAt: now - 101,
        }),
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
        accountAddress: '0xabc',
        maxAgeMs: 100,
      }),
    ).toBeUndefined();
  });

  it('uses the address entry as the fast path when account metadata matches', () => {
    const entry = buildEntry({
      accountAddress: '0xabc',
      indexedAccountId: 'indexed-1',
    });
    const snapshot: IPerpsAccountDisplaySnapshotAtom = {
      entries: {
        '0xabc': entry,
        '0xdef': buildEntry({
          accountAddress: '0xdef',
          indexedAccountId: 'indexed-2',
          updatedAt: now + 1,
        }),
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
        accountAddress: '0xABC',
        indexedAccountId: 'indexed-1',
        deriveType: 'default',
      }),
    ).toBe(entry);
  });

  it('falls back to the newest matching account entry', () => {
    const oldEntry = buildEntry({
      accountAddress: '0xabc',
      accountId: 'account-1',
      updatedAt: now - 50,
    });
    const latestEntry = buildEntry({
      accountAddress: '0xdef',
      accountId: 'account-1',
      updatedAt: now,
    });
    const snapshot: IPerpsAccountDisplaySnapshotAtom = {
      entries: {
        '0xabc': oldEntry,
        '0xdef': latestEntry,
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
        accountId: 'account-1',
        deriveType: 'default',
      }),
    ).toBe(latestEntry);
  });
});
