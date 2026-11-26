import { PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_ENTRIES } from '@onekeyhq/shared/src/consts/perpCache';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import { __resetWebUiSnapshotStoreForTests } from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityAccountValue } from '../entity/SimpleDbEntityAccountValue';
import { SimpleDbEntityAggregateToken } from '../entity/SimpleDbEntityAggregateToken';
import { SimpleDbEntityDeFi } from '../entity/SimpleDbEntityDeFi';
import { SimpleDbEntityLocalNFTs } from '../entity/SimpleDbEntityLocalNFTs';
import { SimpleDbEntityLocalTokens } from '../entity/SimpleDbEntityLocalTokens';
import { SimpleDbEntityPerp } from '../entity/SimpleDbEntityPerp';

import { SimpleDbKeyedEntityBase } from './SimpleDbKeyedEntityBase';
import {
  encodeSnapshotSubKey,
  perpSnapshotCache,
} from './simpleDbSnapshotCacheUtils';

import type ServiceAccount from '../../../services/ServiceAccount/ServiceAccount';

const defaultStorage = storageHub.$webStorageSimpleDB || storageHub.appStorage;

class TestKeyedEntity extends SimpleDbKeyedEntityBase<{
  balance: string;
}> {
  entityName = 'newShardedFeature';
}

describe('SimpleDb storage isolation and write-amplification guards', () => {
  const nativePlatform = platformEnv.isNative;
  beforeEach(() => {
    platformEnv.isNative = true;
    __resetWebUiSnapshotStoreForTests();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    platformEnv.isNative = nativePlatform;
    __resetWebUiSnapshotStoreForTests();
    jest.restoreAllMocks();
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
    const readSnapshot = jest.spyOn(perpSnapshotCache, 'get');
    await expect(perp.getHyperliquidTermsAccepted()).resolves.toBe(true);
    await expect(perp.isFirstPerpOrderOpen('0xuser')).resolves.toBe(false);
    await expect(perp.getOrderBookTickOptions()).resolves.toEqual({
      BTC: { nSigFigs: 5, mantissa: null },
    });
    expect(readSnapshot).not.toHaveBeenCalled();
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

  it('keeps the newest portfolio snapshots and reads each existing record once when trimming', async () => {
    const entity = new SimpleDbEntityPerp();
    await entity.clearHyperliquidPortfolioSnapshot();
    const makeSnapshot = (index: number) => ({
      address: `0x${index}`,
      fetchedAt: index,
    });
    const maxEntries = PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_ENTRIES;
    for (let index = 1; index <= maxEntries; index += 1) {
      await entity.setHyperliquidPortfolioSnapshot(makeSnapshot(index) as any);
    }

    const readSnapshot = jest.spyOn(perpSnapshotCache, 'get');
    await entity.setHyperliquidPortfolioSnapshot(
      makeSnapshot(maxEntries + 1) as any,
    );
    for (let index = 1; index <= maxEntries; index += 1) {
      const key = encodeSnapshotSubKey(
        'portfolio:',
        makeSnapshot(index).address,
      );
      expect(
        readSnapshot.mock.calls.filter(([entryKey]) => entryKey === key),
      ).toHaveLength(1);
    }
    await expect(
      entity.getHyperliquidPortfolioSnapshot('0x1'),
    ).resolves.toBeUndefined();
    await expect(
      entity.getHyperliquidPortfolioSnapshot(
        makeSnapshot(maxEntries + 1).address,
      ),
    ).resolves.toMatchObject(makeSnapshot(maxEntries + 1));
  });

  it('preserves legacy DEX metadata through a preference write before native refresh', async () => {
    const entity = new SimpleDbEntityPerp();
    const universes = [[{ name: 'BTC' }], [{ name: 'xyz:NVDA' }]] as Awaited<
      ReturnType<SimpleDbEntityPerp['getTradingUniverse']>
    >['universesByDex'];
    await defaultStorage.setItem(
      entity.entityKey,
      JSON.stringify({
        data: { tradingUniverses: universes, tradingUniversesUpdatedAt: 123 },
        updatedAt: 123,
      }),
    );

    await entity.setPerpData((prev) => ({
      ...prev,
      hyperliquidTermsAccepted: true,
    }));

    const reloaded = new SimpleDbEntityPerp();
    await expect(reloaded.getTradingUniverse()).resolves.toMatchObject({
      universesByDex: universes,
      updatedAt: 123,
    });

    await reloaded.setTradingUniverse({
      universes: universes.slice(0, 1),
      marginTablesMapList: [],
    });
    await expect(reloaded.getTradingUniverse()).resolves.toMatchObject({
      universesByDex: universes.slice(0, 1),
    });
  });

  it('retries the native valuation migration and merges legacy data without replacing a fresh shard', async () => {
    const entity = new SimpleDbEntityAccountValue();
    await entity.clearRawData();
    const networkId = 'evm--1';
    const accountAddress = '0x456';
    const oldAccountId = 'imported--legacy-fixture';
    const oldAllKey = `${oldAccountId}_${networkId}`;
    await defaultStorage.setItem(
      entity.entityKey,
      JSON.stringify({
        data: {
          all: { stored: { value: { [oldAllKey]: '10' }, currency: 'usd' } },
        },
        updatedAt: 1,
      }),
    );
    await entity.updateAllNetworkAccountValue({
      items: [{ accountAddress, networkId: 'evm--56', value: '20' }],
      currency: 'usd',
    });
    const getDBAccount = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary lookup failure'))
      .mockResolvedValue({ address: accountAddress });
    const serviceAccount = { getDBAccount } as unknown as ServiceAccount;
    await entity.migrateFromAccountIdToAddressKey({ serviceAccount });
    const reloaded = new SimpleDbEntityAccountValue();
    await reloaded.migrateFromAccountIdToAddressKey({ serviceAccount });
    await reloaded.migrateFromAccountIdToAddressKey({ serviceAccount });
    expect(getDBAccount).toHaveBeenCalledTimes(2);
    await expect(
      reloaded.getAllNetworkAccountsValue({ items: [{ accountAddress }] }),
    ).resolves.toEqual([
      { value: { [networkId]: '10', 'evm--56': '20' }, currency: 'usd' },
    ]);
    expect(await defaultStorage.getItem(entity.entityKey)).toContain(oldAllKey);
    await reloaded.clearRawData();
    await reloaded.migrateFromAccountIdToAddressKey({ serviceAccount });
    await expect(
      reloaded.getAllNetworkAccountsValue({ items: [{ accountAddress }] }),
    ).resolves.toEqual([{ value: undefined, currency: undefined }]);
  });

  it.each(['single', 'batch'])(
    'does not advance token write order for a rejected native %s',
    async (mode) => {
      const entity = new SimpleDbEntityLocalTokens();
      const identity = { networkId: 'evm--1', accountAddress: '0x789' };
      const key = accountUtils.buildAccountLocalAssetsKey(identity);
      const older = await entity.reserveAccountTokenListWriteOrder();
      const newer = await entity.reserveAccountTokenListWriteOrder();
      const write = (value: string, writeOrder: number) =>
        entity.updateAccountTokenList({
          ...identity,
          tokenList: [],
          smallBalanceTokenList: [],
          riskyTokenList: [],
          tokenListMap: {},
          tokenListValue: value,
          currency: 'usd',
          hasAssets: true,
          writeOrder,
        });
      const tooLarge = '9'.repeat(4 * 1024 * 1024);
      if (mode === 'single') {
        await write(tooLarge, newer);
      } else {
        await entity.updateAccountTokenListByCache({
          tokenList: {},
          smallBalanceTokenList: {},
          riskyTokenList: {},
          tokenListMap: {},
          tokenListCurrency: {},
          tokenListHasAssets: {},
          tokenListValue: { [key]: tooLarge },
          tokenListWriteOrder: { [key]: newer },
        });
      }
      await write('19', older);
      await expect(
        entity.getAccountTokenList({
          ...identity,
          simpleDbLocalTokensRawData: undefined,
        }),
      ).resolves.toMatchObject({ tokenListValue: '19', hasCache: true });
    },
  );

  it('keeps non-native cache updates on the existing shared storage backend', async () => {
    platformEnv.isNative = false;
    const entity = new SimpleDbEntityAccountValue();
    const owner = { networkId: 'evm--1', accountAddress: '0x768' };

    await entity.updateAccountValue({ ...owner, value: '19', currency: 'usd' });

    expect(await defaultStorage.getItem(entity.entityKey)).toContain('19');
    await expect(
      new SimpleDbEntityAccountValue().getAccountsValue({ items: [owner] }),
    ).resolves.toEqual([{ value: '19', currency: 'usd' }]);
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
