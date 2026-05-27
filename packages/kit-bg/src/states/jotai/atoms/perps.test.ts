import {
  type IPerpsAccountDisplaySnapshotAtom,
  getPerpsAccountDisplaySnapshotEntry,
} from './perps';

const now = 1_000_000;

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
        '0xabc': {
          account: {
            accountAddress: '0xabc',
            accountId: 'account-1',
            indexedAccountId: 'indexed-1',
            deriveType: 'default',
          },
          accountValue: '123',
          withdrawable: '100',
          availableToTrade: {
            coin: 'BTC',
            value: '10',
            updatedAt: now,
          },
          updatedAt: now,
        },
      },
    };

    expect(
      getPerpsAccountDisplaySnapshotEntry({
        snapshot,
      }),
    ).toBeUndefined();
  });
});
