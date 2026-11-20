import fs from 'fs';
import path from 'path';

import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import { __resetWebUiSnapshotStoreForTests } from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore';
import {
  LEGACY_APP_STORAGE_ENTITY_NAMES,
  SHARDED_SNAPSHOT_SIMPLE_DB_ENTITY_NAMES,
  isLegacyAppStorageEntityName,
  isShardedSnapshotSimpleDbEntityName,
  resolveSimpleDbStorageTarget,
} from '@onekeyhq/shared/src/storage/simpleDbStorageIsolation';

import { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityAccountValue } from '../entity/SimpleDbEntityAccountValue';
import { SimpleDbEntityAggregateToken } from '../entity/SimpleDbEntityAggregateToken';
import { SimpleDbEntityDeFi } from '../entity/SimpleDbEntityDeFi';
import { SimpleDbEntityLocalNFTs } from '../entity/SimpleDbEntityLocalNFTs';
import { SimpleDbEntityLocalTokens } from '../entity/SimpleDbEntityLocalTokens';
import { SimpleDbEntityPerp } from '../entity/SimpleDbEntityPerp';

import { SimpleDbKeyedEntityBase } from './SimpleDbKeyedEntityBase';
import { encodeSnapshotSubKey } from './simpleDbSnapshotCacheUtils';

const defaultStorage = storageHub.$webStorageSimpleDB || storageHub.appStorage;

class TestKeyedEntity extends SimpleDbKeyedEntityBase<{
  balance: string;
}> {
  entityName = 'newShardedFeature';
}

describe('SimpleDb storage isolation and write-amplification guards', () => {
  beforeEach(() => {
    __resetWebUiSnapshotStoreForTests();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    __resetWebUiSnapshotStoreForTests();
    jest.restoreAllMocks();
  });

  it('freezes the historical onekey-app-storage-v1 whitelist and routes new or keyed entities to isolated files', () => {
    expect(LEGACY_APP_STORAGE_ENTITY_NAMES).toHaveLength(78);
    expect(SHARDED_SNAPSHOT_SIMPLE_DB_ENTITY_NAMES).toEqual([
      'accountValue',
      'LocalNFTs',
      'localTokens',
    ]);

    const entityDir = path.resolve(__dirname, '../entity');
    const entityFiles = fs
      .readdirSync(entityDir)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));

    for (const file of entityFiles) {
      const source = fs.readFileSync(path.join(entityDir, file), 'utf8');
      const match = source.match(
        /entityName\s*(?::\s*string\s*)?=\s*'([^']+)'/,
      );
      if (match) {
        const entityName = match[1];
        if (isShardedSnapshotSimpleDbEntityName(entityName)) {
          expect(isLegacyAppStorageEntityName(entityName)).toBe(false);
          expect(
            resolveSimpleDbStorageTarget(`simple_db_v5:${entityName}`),
          ).toEqual({
            isolated: true,
            entityName,
            mmkvId: expect.stringMatching(/^onekey-simple-db-/),
            subKey: undefined,
          });
        } else {
          expect(isLegacyAppStorageEntityName(entityName)).toBe(true);
          expect(
            resolveSimpleDbStorageTarget(`simple_db_v5:${entityName}`),
          ).toEqual({
            isolated: false,
          });
        }
      }
    }

    // Any brand-new SimpleDbEntity or any sub-keyed record routes to its own
    // isolated MMKV file instead of `onekey-app-storage-v1`.
    expect(resolveSimpleDbStorageTarget('simple_db_v5:brandNewEntity')).toEqual(
      {
        isolated: true,
        entityName: 'brandNewEntity',
        mmkvId: 'onekey-simple-db-brand-new-entity',
        subKey: undefined,
      },
    );
    expect(resolveSimpleDbStorageTarget('simple_db_v5:perp:subKeyA')).toEqual({
      isolated: true,
      entityName: 'perp',
      mmkvId: 'onekey-simple-db-perp',
      subKey: 'subKeyA',
    });
  });

  it('stores SimpleDbKeyedEntityBase records by sub-key without rewriting sibling keys', async () => {
    const entity = new TestKeyedEntity();
    const setItemSpy = jest.spyOn(defaultStorage, 'setItem');

    await entity.setRecord('acct-a', { balance: '100' });
    await entity.setRecord('acct-b', { balance: '200' });

    expect(setItemSpy).toHaveBeenCalledTimes(2);
    expect(setItemSpy.mock.calls[0]?.[0]).toBe(
      'simple_db_v5:newShardedFeature:acct-a',
    );
    expect(setItemSpy.mock.calls[1]?.[0]).toBe(
      'simple_db_v5:newShardedFeature:acct-b',
    );
    expect(
      resolveSimpleDbStorageTarget('simple_db_v5:newShardedFeature:acct-a'),
    ).toEqual({
      isolated: true,
      entityName: 'newShardedFeature',
      mmkvId: 'onekey-simple-db-new-sharded-feature',
      subKey: 'acct-a',
    });

    await expect(entity.getRecord('acct-a')).resolves.toEqual({
      balance: '100',
    });
    await expect(entity.getRecord('acct-b')).resolves.toEqual({
      balance: '200',
    });

    // No-op builder returning previous reference skips storage write.
    setItemSpy.mockClear();
    await entity.setRecord('acct-a', (prev) => prev ?? { balance: '0' });
    expect(setItemSpy).not.toHaveBeenCalled();

    await entity.removeRecord('acct-a');
    await expect(entity.getRecord('acct-a')).resolves.toBeUndefined();
    await expect(entity.getRecord('acct-b')).resolves.toEqual({
      balance: '200',
    });
  });

  it('splits SimpleDbEntityPerp high-frequency caches out of appStorage while keeping user preferences in place', async () => {
    const perp = new SimpleDbEntityPerp();
    const setItemSpy = jest.spyOn(defaultStorage, 'setItem');

    // Seed historical record with both user preferences and old large cache fields.
    await defaultStorage.setItem(
      'simple_db_v5:perp',
      JSON.stringify({
        data: {
          hyperliquidTermsAccepted: true,
          perpOrderOpenFlags: { '0xuser': true },
          hyperliquidOrderBookTickOptions: {
            BTC: { nSigFigs: 5, mantissa: null },
          },
          activeAssetCtxSnapshotCache: {
            BTC: { data: { coin: 'BTC' }, updatedAt: 1 },
          },
          l2BookSnapshotCache: {
            'BTC::': { data: { coin: 'BTC', levels: [[], []] }, updatedAt: 1 },
          },
        },
        updatedAt: 1,
      }),
    );
    setItemSpy.mockClear();

    // High-frequency cache writes go to SnapshotCache and never write appStorage.
    await perp.setActiveAssetCtxSnapshotCache({
      coin: 'ETH',
      ctx: { markPx: '3000' } as any,
    });
    await perp.setL2BookSnapshotCaches([
      {
        coin: 'ETH',
        nSigFigs: 5,
        mantissa: null,
        data: { coin: 'ETH', levels: [[], []] } as any,
      },
    ]);
    await perp.setPerpsAccountDisplaySummary({
      accountAddress: '0xAbC',
      data: {
        accountAddress: '0xabc',
        accountValue: '500',
        totalMarginUsed: '0',
        crossAccountValue: '500',
        crossMaintenanceMarginUsed: '0',
        isolatedMarginUsed: '0',
        totalNtlPos: '0',
        totalRawUsd: '500',
        withdrawable: '500',
        totalUnrealizedPnl: '0',
      },
    });
    await perp.setHyperliquidPortfolioSnapshot({
      address: '0xAbC',
      netWorthUsd: '500',
      fetchedAt: Date.now(),
    } as any);

    expect(setItemSpy).not.toHaveBeenCalled();

    // Cache reads hit SnapshotCache.
    await expect(
      perp.getActiveAssetCtxSnapshotCache({ coin: 'ETH', maxAgeMs: 60_000 }),
    ).resolves.toMatchObject({
      data: { coin: 'ETH' },
    });
    await expect(
      perp.getPerpsAccountDisplayCache('0xabc'),
    ).resolves.toMatchObject({
      accountAddress: '0xabc',
      summary: {
        data: expect.objectContaining({ accountValue: '500' }),
      },
    });
    await expect(
      perp.getHyperliquidPortfolioSnapshot('0xabc'),
    ).resolves.toMatchObject({
      address: '0xabc',
      netWorthUsd: '500',
    });

    // User preferences remain readable from appStorage, and getPerpData merges
    // portfolio snapshots for accountSelectorPerpsWorth compatibility.
    await expect(perp.getHyperliquidTermsAccepted()).resolves.toBe(true);
    await expect(perp.isFirstPerpOrderOpen('0xuser')).resolves.toBe(false);
    await expect(perp.getOrderBookTickOptions()).resolves.toEqual({
      BTC: { nSigFigs: 5, mantissa: null },
    });
    const fullPerpData = await perp.getPerpData();
    expect(
      fullPerpData.hyperliquidPortfolioSnapshotByAddress?.['0xabc']
        ?.netWorthUsd,
    ).toBe('500');

    // Updating a user preference writes to appStorage and strips the old cache residue.
    await perp.setCurrentToken('SOL');
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const persistedRaw = await defaultStorage.getItem('simple_db_v5:perp');
    const persisted = JSON.parse(String(persistedRaw)) as {
      data: Record<string, unknown>;
    };
    expect(persisted.data.hyperliquidCurrentToken).toBe('SOL');
    expect(persisted.data.hyperliquidTermsAccepted).toBe(true);
    expect(persisted.data.activeAssetCtxSnapshotCache).toBeUndefined();
    expect(persisted.data.l2BookSnapshotCache).toBeUndefined();
  });

  it('routes pure-cache and mixed entities (localTokens, LocalNFTs, accountValue, aggregateToken, deFi) to sharded SnapshotCache without writing appStorage on cache updates', async () => {
    const localTokens = new SimpleDbEntityLocalTokens();
    const localNFTs = new SimpleDbEntityLocalNFTs();
    const accountValue = new SimpleDbEntityAccountValue();
    const aggregateToken = new SimpleDbEntityAggregateToken();
    const deFi = new SimpleDbEntityDeFi();
    const setItemSpy = jest.spyOn(defaultStorage, 'setItem');

    await localTokens.updateAccountTokenList({
      networkId: 'evm--1',
      accountAddress: '0x123',
      tokenList: [],
      smallBalanceTokenList: [],
      riskyTokenList: [],
      tokenListMap: {},
      tokenListValue: '42',
      currency: 'usd',
      hasAssets: true,
    });
    await localNFTs.updateAccountNFTs({
      networkId: 'evm--1',
      accountAddress: '0x123',
      nfts: [{ itemId: '1' } as any],
    });
    await accountValue.updateAccountValue({
      networkId: 'evm--1',
      accountAddress: '0x123',
      value: '42',
      currency: 'usd',
    });
    await aggregateToken.updateAggregateTokenListMap({
      networkId: 'evm--1',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      aggregateTokenListMap: { USDT: { tokens: [] } },
    });
    await deFi.updateAccountDeFiOverview({
      accountAddress: '0x123',
      overview: {
        'evm--1': {
          totalValue: 10,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 10,
          currency: 'usd',
        },
      },
    });

    // None of the cache updates above should touch appStorage (`onekey-app-storage-v1`).
    expect(setItemSpy).not.toHaveBeenCalled();

    await expect(
      localTokens.getAccountTokenList({
        networkId: 'evm--1',
        accountAddress: '0x123',
        simpleDbLocalTokensRawData: undefined,
      }),
    ).resolves.toMatchObject({
      tokenListValue: '42',
      hasCache: true,
      currency: 'usd',
    });
    await expect(
      localNFTs.getAccountNFTs({
        networkId: 'evm--1',
        accountAddress: '0x123',
      }),
    ).resolves.toHaveLength(1);
    await expect(
      accountValue.getAccountsValue({
        items: [{ networkId: 'evm--1', accountAddress: '0x123' }],
      }),
    ).resolves.toEqual([{ value: '42', currency: 'usd' }]);
    await expect(
      aggregateToken.getAggregateTokenListMap({
        networkId: 'evm--1',
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    ).resolves.toEqual({ USDT: { tokens: [] } });
    await expect(
      deFi.getAccountsDeFiOverview({
        accounts: [{ accountAddress: '0x123' }],
      }),
    ).resolves.toEqual([
      {
        accountAddress: '0x123',
        xpub: undefined,
        overview: {
          'evm--1': {
            totalValue: 10,
            totalDebt: 0,
            totalReward: 0,
            netWorth: 10,
            currency: 'usd',
          },
        },
      },
    ]);
  });

  it('persists in-place mutating legacy entities while skipping no-op writes on DeFi', async () => {
    await defaultStorage.clear();
    const accountSelector = new SimpleDbEntityAccountSelector();
    await accountSelector.saveGlobalDeriveType({
      networkId: 'evm--1',
      deriveType: 'default',
    });

    const setItemSpy = jest.spyOn(defaultStorage, 'setItem');
    await accountSelector.saveGlobalDeriveType({
      networkId: 'evm--1',
      deriveType: 'BIP44' as any,
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    // Reload from a fresh instance (bypassing cachedRawData) to verify persistence.
    const freshAccountSelector = new SimpleDbEntityAccountSelector();
    await expect(
      freshAccountSelector.getGlobalDeriveType({
        networkId: 'evm--1',
      }),
    ).resolves.toBe('BIP44');

    // Verify DeFi no-op writes do not trigger appStorage.setItem.
    const deFi = new SimpleDbEntityDeFi();
    await deFi.updateEnabledNetworksMap({
      enabledNetworksMap: { 'evm--1': true },
    });
    const firstQuota = await deFi.consumeManualForceRefreshQuota({
      dayKey: '2026-11-20',
      now: 100_000,
      dailyLimit: 5,
      minIntervalMs: 60_000,
    });
    expect(firstQuota.allowed).toBe(true);

    setItemSpy.mockClear();
    // Repeated update with identical enabledNetworksMap should be skipped.
    await deFi.updateEnabledNetworksMap({
      enabledNetworksMap: { 'evm--1': true },
    });
    // Rejected manual force refresh within interval should be skipped.
    const rejectedQuota = await deFi.consumeManualForceRefreshQuota({
      dayKey: '2026-11-20',
      now: 100_005,
      dailyLimit: 5,
      minIntervalMs: 60_000,
    });
    expect(rejectedQuota.allowed).toBe(false);
    expect(setItemSpy).not.toHaveBeenCalled();

    // Preserves hyphens literally in encoded snapshot sub-keys.
    const encoded = encodeSnapshotSubKey(
      'acct:',
      "evm--1_hd-1--m/44'/60'/0'/0/0",
    );
    expect(encoded).toContain('evm--1_');
    expect(encoded).not.toContain('-x2d-');
  });
});
