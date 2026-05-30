import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { jotaiDefaultStore } from '../utils/jotaiDefaultStore';

import {
  type IPerpsAccountDisplaySnapshotAtom,
  type IPerpsAccountDisplaySnapshotEntry,
  getPerpsAccountDisplaySnapshotEntry,
  perpsAbstractionModeAtom,
  perpsActiveAccountAtom,
  perpsActiveAccountStatusAtom,
  perpsActiveAccountStatusInfoAtom,
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
    activeAsset: {
      coin: 'BTC',
      leverage: {
        type: 'cross',
        value: 25,
      },
      updatedAt,
    },
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

describe('perpsActiveAccountStatusAtom', () => {
  afterEach(() => {
    jotaiDefaultStore.set(perpsActiveAccountAtom.atom(), {
      accountId: null,
      indexedAccountId: null,
      deriveType: 'default',
      accountAddress: null,
    });
    jotaiDefaultStore.set(perpsActiveAccountStatusInfoAtom.atom(), undefined);
    jotaiDefaultStore.set(perpsAbstractionModeAtom.atom(), undefined);
  });

  it('ignores cached abstraction mode when deriving canTrade', () => {
    jotaiDefaultStore.set(perpsActiveAccountAtom.atom(), {
      accountId: 'account-1',
      indexedAccountId: 'indexed-1',
      deriveType: 'default',
      accountAddress: '0xabc',
    });
    jotaiDefaultStore.set(perpsActiveAccountStatusInfoAtom.atom(), {
      accountAddress: '0xabc',
      details: {
        activatedOk: true,
        agentOk: true,
        referralCodeOk: true,
        builderFeeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: false,
      },
    });
    jotaiDefaultStore.set(perpsAbstractionModeAtom.atom(), {
      accountAddress: '0xabc',
      mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      source: 'cache',
    });

    expect(jotaiDefaultStore.get(perpsActiveAccountStatusAtom.atom())).toEqual(
      expect.objectContaining({
        canTrade: false,
      }),
    );
  });

  it('uses live abstraction mode to update canTrade immediately', () => {
    jotaiDefaultStore.set(perpsActiveAccountAtom.atom(), {
      accountId: 'account-1',
      indexedAccountId: 'indexed-1',
      deriveType: 'default',
      accountAddress: '0xabc',
    });
    jotaiDefaultStore.set(perpsActiveAccountStatusInfoAtom.atom(), {
      accountAddress: '0xabc',
      details: {
        activatedOk: true,
        agentOk: true,
        referralCodeOk: true,
        builderFeeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: false,
      },
    });
    jotaiDefaultStore.set(perpsAbstractionModeAtom.atom(), {
      accountAddress: '0xabc',
      mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      source: 'live',
    });

    expect(jotaiDefaultStore.get(perpsActiveAccountStatusAtom.atom())).toEqual(
      expect.objectContaining({
        canTrade: true,
      }),
    );
  });
});
