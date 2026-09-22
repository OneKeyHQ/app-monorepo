import {
  OWNER_WORTH_CACHE_CAP,
  clearOwnerWorthCache,
  getOwnerWorth,
  getOwnerWorthCacheSize,
  rememberOwnerWorth,
} from './ownerWorthCache';

const mockRecords = new Map<string, Record<string, unknown>>();
jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/storage/uiSnapshotCaches',
  ) as Record<string, unknown>;
  return {
    ...actual,
    tokenListOwnerWorthCache: {
      get: (key: string) => {
        const data = mockRecords.get(key);
        return data ? { data, updatedAt: 0 } : undefined;
      },
      set: (key: string, data: Record<string, unknown>) => {
        mockRecords.set(key, data);
      },
      setMany: () => undefined,
      remove: (key: string) => mockRecords.delete(key),
      keys: () => Array.from(mockRecords.keys()),
      sweep: () => undefined,
      clear: () => mockRecords.clear(),
    },
  };
});

const snapshot = (v: string) => ({
  worth: { 'acc__net': v },
  createAtNetworkWorth: v,
  currency: 'usd',
});

beforeEach(() => {
  clearOwnerWorthCache();
  mockRecords.clear();
});

describe('ownerWorthCache', () => {
  it('remembers per owner, persists, and survives a memory clear (fresh process)', () => {
    rememberOwnerWorth('accA__net', snapshot('7'));
    expect(getOwnerWorth('accA__net')?.createAtNetworkWorth).toBe('7');
    expect(mockRecords.size).toBe(1);
    clearOwnerWorthCache();
    expect(getOwnerWorthCacheSize()).toBe(0);
    expect(getOwnerWorth('accA__net')).toEqual(snapshot('7'));
    expect(getOwnerWorth('accB__net')).toBeUndefined();
  });

  it('bounds the memory to the cap, evicting the least recently used owner', () => {
    for (let i = 0; i <= OWNER_WORTH_CACHE_CAP; i += 1) {
      rememberOwnerWorth(`acc${i}__net`, snapshot(String(i)));
    }
    expect(getOwnerWorthCacheSize()).toBe(OWNER_WORTH_CACHE_CAP);
    // owner 0 was evicted from memory but is still persisted
    mockRecords.clear();
    expect(getOwnerWorth('acc0__net')).toBeUndefined();
    expect(
      getOwnerWorth(`acc${OWNER_WORTH_CACHE_CAP}__net`)?.createAtNetworkWorth,
    ).toBe(String(OWNER_WORTH_CACHE_CAP));
  });

  it('ignores malformed persisted mockRecords', () => {
    mockRecords.set(
      Object.keys(mockRecords)[0] ?? 'homeAccountWorth/accX-x5f--x5f-net',
      { worth: 'nope' },
    );
    expect(getOwnerWorth('accX__net')).toBeUndefined();
  });
});
