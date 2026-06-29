/* cspell:ignore xtoken xbob */
import { SimpleDbEntityAccountValue } from './SimpleDbEntityAccountValue';
import { SimpleDbEntityAggregateToken } from './SimpleDbEntityAggregateToken';
import { SimpleDbEntityDeFi } from './SimpleDbEntityDeFi';
import { SimpleDbEntityLocalHistory } from './SimpleDbEntityLocalHistory';
import { SimpleDbEntityLocalNFTs } from './SimpleDbEntityLocalNFTs';
import { SimpleDbEntityLocalTokens } from './SimpleDbEntityLocalTokens';

/*
yarn jest packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityOrphanCleanup.test.ts
*/

// removeOrphanData reads `existing` (pre-mutex) then hands setRawData a builder
// that re-reads the in-mutex `rawData`. We mock getRawData to satisfy the
// `if (!existing) return` guard and capture the builder, so we can probe it with
// arbitrary rawData — crucially `null`, which models a concurrent clearRawData
// ("Clear cache") nulling the store mid-sweep. The builder MUST NOT fall back to
// `existing` (that would resurrect the just-cleared cache).
async function captureBuilder(
  entity: { removeOrphanData: (arg: any) => Promise<void> },
  existing: any,
  arg: any,
): Promise<(rawData: any) => any> {
  jest.spyOn(entity as any, 'getRawData').mockResolvedValue(existing);
  let builder: ((rawData: any) => any) | undefined;
  jest.spyOn(entity as any, 'setRawData').mockImplementation(async (b: any) => {
    builder = b;
    return undefined;
  });
  await entity.removeOrphanData(arg);
  // removeOrphanData always calls setRawData (the `if (!existing) return` guard
  // is satisfied by the non-null getRawData mock above), so builder is assigned.
  expect(builder).toBeDefined();
  return builder as (rawData: any) => any;
}

afterEach(() => {
  jest.restoreAllMocks();
});

const DAY_MS = 24 * 60 * 60 * 1000;
// Mirror the module-private caps (not exported).
const LOCAL_NFTS_MAX_PER_ACCOUNT = 500;
const LOCAL_TOKENS_METADATA_MAX_ENTRIES = 5000;

describe('SimpleDbEntityLocalNFTs.removeOrphanData', () => {
  test('drops orphan keys, keeps valid keys, caps arrays at 500', async () => {
    const entity = new SimpleDbEntityLocalNFTs();
    const existing = {
      list: {
        'evm--1_0xalice': Array.from(
          { length: LOCAL_NFTS_MAX_PER_ACCOUNT + 1 },
          (_, i) => ({ id: i }),
        ),
        'evm--1_0xbob': [{ id: 1 }], // orphan (0xbob deleted)
      },
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(existing);
    expect(Object.keys(result.list)).toEqual(['evm--1_0xalice']);
    expect(result.list['evm--1_0xalice']).toHaveLength(
      LOCAL_NFTS_MAX_PER_ACCOUNT,
    );
  });

  test('does NOT resurrect cleared cache when store is cleared mid-flight', async () => {
    const entity = new SimpleDbEntityLocalNFTs();
    const existing = { list: { 'evm--1_0xalice': [{ id: 1 }] } };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    // Concurrent clearRawData -> in-mutex rawData is null/undefined.
    expect(builder(null)).toEqual({ list: {} });
    expect(builder(undefined)).toEqual({ list: {} });
    // Sanity: normal path still filters correctly.
    expect(builder(existing)).toEqual({
      list: { 'evm--1_0xalice': [{ id: 1 }] },
    });
  });
});

describe('SimpleDbEntityLocalTokens.removeOrphanData', () => {
  test('filters per-account lists by owner and caps the global data map', async () => {
    const entity = new SimpleDbEntityLocalTokens();
    const data = Object.fromEntries(
      Array.from({ length: LOCAL_TOKENS_METADATA_MAX_ENTRIES + 1 }, (_, i) => [
        `evm--1__0xtoken${i}`,
        { address: `0xtoken${i}` },
      ]),
    );
    const existing = {
      data,
      tokenList: { 'evm--1_0xalice': [{}], 'evm--1_0xbob': [{}] },
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: { 'evm--1_0xbob': {} }, // orphan
      tokenListValue: {},
      tokenListCurrency: {},
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(existing);
    // global metadata capped to the most-recent N (oldest dropped)
    expect(Object.keys(result.data)).toHaveLength(
      LOCAL_TOKENS_METADATA_MAX_ENTRIES,
    );
    expect(result.data['evm--1__0xtoken0']).toBeUndefined();
    expect(
      result.data[`evm--1__0xtoken${LOCAL_TOKENS_METADATA_MAX_ENTRIES}`],
    ).toBeDefined();
    // per-account maps orphan-filtered
    expect(Object.keys(result.tokenList)).toEqual(['evm--1_0xalice']);
    expect(result.tokenListMap).toEqual({});
  });

  test('does NOT resurrect cleared cache when store is cleared mid-flight', async () => {
    const entity = new SimpleDbEntityLocalTokens();
    const existing = {
      data: { 'evm--1__0xt': {} },
      tokenList: { 'evm--1_0xalice': [{}] },
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: {},
      tokenListValue: {},
      tokenListCurrency: {},
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(null);
    expect(result.data).toEqual({});
    expect(result.tokenList).toEqual({});
  });
});

describe('SimpleDbEntityLocalHistory.removeOrphanData', () => {
  test('drops only orphan keys; keeps ALL pending txs of valid owners (no age prune)', async () => {
    const entity = new SimpleDbEntityLocalHistory();
    const now = Date.now();
    const existing = {
      pendingTxs: {
        'evm--1_0xalice': [
          { decodedTx: { createdAt: now } },
          // Old, but NOT pruned: ServiceFreshAddress reads pendingTxs to avoid
          // BTC address reuse, so age-pruning was removed.
          { decodedTx: { createdAt: now - 15 * DAY_MS } },
          { decodedTx: {} }, // no timestamp
        ],
        'evm--1_0xbob': [{ decodedTx: { createdAt: now } }], // orphan -> drop key
      },
      confirmedTxs: {
        'evm--1_0xalice': [{ decodedTx: { createdAt: now } }],
        'evm--1_0xbob': [{ decodedTx: { createdAt: now } }], // orphan -> drop key
      },
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(existing);
    expect(Object.keys(result.pendingTxs)).toEqual(['evm--1_0xalice']);
    // all 3 retained — no age prune (protects ServiceFreshAddress dedup)
    expect(result.pendingTxs['evm--1_0xalice']).toHaveLength(3);
    expect(Object.keys(result.confirmedTxs)).toEqual(['evm--1_0xalice']);
  });

  test('does NOT resurrect cleared cache when store is cleared mid-flight', async () => {
    const entity = new SimpleDbEntityLocalHistory();
    const existing = {
      pendingTxs: { 'evm--1_0xalice': [{ decodedTx: {} }] },
      confirmedTxs: {},
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    expect(builder(null)).toEqual({ pendingTxs: {}, confirmedTxs: {} });
  });
});

describe('SimpleDbEntityAccountValue.removeOrphanData', () => {
  test('filters byAddress (networkId-prefixed) + allByAddress (bare), preserves legacy fields', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const existing = {
      byAddress: {
        'evm--1_0xalice': { value: '1', currency: 'usd' },
        'evm--56_0xalice': { value: '3', currency: 'usd' }, // same owner, other net
        'evm--1_0xbob': { value: '2', currency: 'usd' }, // orphan
      },
      allByAddress: {
        '0xalice': { value: { 'evm--1': '1' }, currency: 'usd' },
        '0xbob': { value: {}, currency: 'usd' }, // orphan
      },
      _legacy_data: { foo: { value: '1', currency: 'usd' } },
      _migrationVersion: 1,
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(existing);
    expect(Object.keys(result.byAddress).toSorted()).toEqual([
      'evm--1_0xalice',
      'evm--56_0xalice',
    ]);
    expect(Object.keys(result.allByAddress)).toEqual(['0xalice']);
    // migration/legacy fields survive a normal sweep
    expect(result._legacy_data).toEqual({
      foo: { value: '1', currency: 'usd' },
    });
    expect(result._migrationVersion).toBe(1);
  });

  test('does NOT resurrect cleared cache (rawData null -> empty, legacy not restored)', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const existing = {
      byAddress: { 'evm--1_0xalice': { value: '1', currency: 'usd' } },
      allByAddress: {},
      _legacy_data: { foo: {} },
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(null);
    expect(result.byAddress).toEqual({});
    expect(result.allByAddress).toEqual({});
    // store was cleared concurrently; nothing (incl. legacy) is written back
    expect(result._legacy_data).toBeUndefined();
  });
});

describe('SimpleDbEntityDeFi.removeOrphanData', () => {
  test('filters overview by bare owner key, preserves sibling fields', async () => {
    const entity = new SimpleDbEntityDeFi();
    const existing = {
      overview: { '0xalice': { foo: 1 }, '0xbob': { foo: 2 } },
      keepMe: 'global',
    };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    const result = builder(existing);
    expect(Object.keys(result.overview)).toEqual(['0xalice']);
    expect(result.keepMe).toBe('global');
  });

  test('does NOT resurrect cleared cache when store is cleared mid-flight', async () => {
    const entity = new SimpleDbEntityDeFi();
    const existing = { overview: { '0xalice': {} } };
    const builder = await captureBuilder(entity, existing, {
      validOwners: ['0xalice'],
    });
    expect(builder(null)).toEqual({ overview: {} });
  });
});

describe('SimpleDbEntityAggregateToken.removeOrphanData', () => {
  const aliceId = "hd-1--m/44'/60'/0'/0/0";
  const bobId = "hd-2--m/44'/60'/0'/0/0";

  test('filters per-account maps by accountId, preserves global config maps', async () => {
    const entity = new SimpleDbEntityAggregateToken();
    const existing = {
      // `${networkId}_${accountId}` keys
      aggregateTokenMapV2: {
        [`evm--1_${aliceId}`]: {},
        [`evm--1_${bobId}`]: {}, // orphan
      },
      aggregateTokenListMap: { [`evm--1_${aliceId}`]: {} },
      // bare accountId keys
      tokenDetails: { [aliceId]: {}, [bobId]: {} },
      // global maps must be left intact
      aggregateTokenConfigMap: { global: {} },
      allAggregateTokens: [{ x: 1 }],
    };
    const builder = await captureBuilder(entity, existing, {
      validAccountIds: [aliceId],
    });
    const result = builder(existing);
    expect(Object.keys(result.aggregateTokenMapV2)).toEqual([
      `evm--1_${aliceId}`,
    ]);
    expect(Object.keys(result.tokenDetails)).toEqual([aliceId]);
    expect(result.aggregateTokenConfigMap).toEqual({ global: {} });
    expect(result.allAggregateTokens).toEqual([{ x: 1 }]);
  });

  test('does NOT resurrect cleared cache when store is cleared mid-flight', async () => {
    const entity = new SimpleDbEntityAggregateToken();
    const existing = {
      aggregateTokenMapV2: { [`evm--1_${aliceId}`]: {} },
      aggregateTokenListMap: {},
      tokenDetails: {},
    };
    const builder = await captureBuilder(entity, existing, {
      validAccountIds: [aliceId],
    });
    const result = builder(null);
    expect(result.aggregateTokenMapV2).toEqual({});
    expect(result.aggregateTokenListMap).toEqual({});
    expect(result.tokenDetails).toEqual({});
  });
});
