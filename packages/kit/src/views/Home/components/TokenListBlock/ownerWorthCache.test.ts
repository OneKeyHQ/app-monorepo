import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { buildTokenListOwnerSlimCacheKey } from '@onekeyhq/shared/src/storage/uiSnapshotCaches';

import {
  OWNER_WORTH_CACHE_CAP,
  clearOwnerWorthCache,
  getOwnerWorth,
  getOwnerWorthCacheSize,
  purgeOwnerWorthCache,
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
      touch: () => undefined,
      remove: (key: string) => mockRecords.delete(key),
      keys: () => Array.from(mockRecords.keys()),
      sweep: () => undefined,
      clear: () => mockRecords.clear(),
    },
  };
});

// Same key construction as the module under test, so a record written here is
// the record `getOwnerWorth` actually reads.
const persistedKey = (ownerKey: string) =>
  buildTokenListOwnerSlimCacheKey({
    storeName: 'homeAccountWorth',
    ownerKey,
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
    // Owner 0 was evicted from memory but is still persisted, so it is still
    // readable (and gets re-admitted to memory).
    expect(getOwnerWorth('acc0__net')?.createAtNetworkWorth).toBe('0');
    // With the persisted slot gone too, the evicted owner is unknown.
    clearOwnerWorthCache();
    mockRecords.clear();
    expect(getOwnerWorth('acc0__net')).toBeUndefined();
  });

  it('ignores a persisted record whose worth is not an object', () => {
    mockRecords.set(persistedKey('accX__net'), { worth: 'nope' });
    expect(getOwnerWorth('accX__net')).toBeUndefined();
  });

  it('coerces a non-string createAtNetworkWorth / currency instead of passing it on', () => {
    mockRecords.set(persistedKey('accY__net'), {
      worth: { 'accY_net': '3' },
      createAtNetworkWorth: 3,
      currency: 7,
    });
    expect(getOwnerWorth('accY__net')).toEqual({
      worth: { 'accY_net': '3' },
      createAtNetworkWorth: '0',
      currency: undefined,
    });
  });

  it('purges memory and the persisted namespace together', () => {
    rememberOwnerWorth('accA__net', snapshot('1'));
    purgeOwnerWorthCache();
    expect(getOwnerWorthCacheSize()).toBe(0);
    expect(mockRecords.size).toBe(0);
    expect(getOwnerWorth('accA__net')).toBeUndefined();
  });

  it.each([
    EAppEventBusNames.WalletRemove,
    EAppEventBusNames.AccountRemove,
    EAppEventBusNames.WalletClear,
  ])(
    'purges on %s so a re-created owner never replays a deleted worth',
    (name) => {
      rememberOwnerWorth('accA__net', snapshot('1'));
      appEventBus.emit(name as EAppEventBusNames.WalletClear, undefined);
      expect(getOwnerWorth('accA__net')).toBeUndefined();
      expect(mockRecords.size).toBe(0);
    },
  );
});
