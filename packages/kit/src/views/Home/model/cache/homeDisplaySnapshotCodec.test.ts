import { buildHomeBannerCoverageFingerprint } from '../sections/banner/homeBannerStoreModel';

import {
  createHomeDisplaySnapshotDescriptor,
  decodeHomeDisplaySnapshotCritical,
  decodeHomeDisplaySnapshotManifest,
  decodeHomeDisplaySnapshotRoute,
  decodeHomeDisplaySnapshotSourceChunk,
  encodeHomeDisplaySnapshotCritical,
  encodeHomeDisplaySnapshotManifest,
  encodeHomeDisplaySnapshotRoute,
  encodeHomeDisplaySnapshotSourceChunk,
} from './homeDisplaySnapshotCodec';
import {
  getHomeDisplaySnapshotPartitionId,
  getHomeDisplaySnapshotPartitionTag,
} from './homeDisplaySnapshotKeys';
import { HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION } from './homeDisplaySnapshotTypes';

const ownerScopeKey = 'wallet-a:account-a:network-eth';
const partitionId = getHomeDisplaySnapshotPartitionId(ownerScopeKey);
const now = 1000;

describe('Home display snapshot codec', () => {
  it('uses a deterministic opaque partition id and restores runtime defaults', () => {
    expect(partitionId).toHaveLength(64);
    expect(partitionId).not.toContain(ownerScopeKey);
    expect(getHomeDisplaySnapshotPartitionId(ownerScopeKey)).toBe(partitionId);
    expect(getHomeDisplaySnapshotPartitionTag(ownerScopeKey)).toBe(
      partitionId.slice(0, 12),
    );
    expect(getHomeDisplaySnapshotPartitionTag(ownerScopeKey)).not.toContain(
      ownerScopeKey,
    );
    expect(getHomeDisplaySnapshotPartitionId(`${ownerScopeKey}:sol`)).not.toBe(
      partitionId,
    );

    const raw = encodeHomeDisplaySnapshotCritical({
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      ownerScopeKey,
      createdAt: now,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          header: {
            kind: 'zero',
            balance: { amount: '0', currency: 'USD' },
          },
          actions: { kind: 'zero', items: ['receive'] },
          banner: { kind: 'none' },
        },
      },
      navigation: {
        kind: 'ready',
        tabs: ['portfolio', 'defi'],
      },
    });
    const legacyExpiredRaw = JSON.stringify({
      ...JSON.parse(raw ?? '{}'),
      expiresAt: now - 1,
    });
    expect(
      decodeHomeDisplaySnapshotCritical({
        raw: legacyExpiredRaw,
        expectedOwnerScopeKey: ownerScopeKey,
      }),
    ).toMatchObject({
      ownerScopeKey,
      navigation: {
        selectedTabId: 'portfolio',
      },
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'zero',
          priority: 0,
          refresh: 'refreshing',
        },
      },
    });
    const legacyRouteRaw = JSON.stringify({
      ...JSON.parse(
        encodeHomeDisplaySnapshotRoute({
          schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
          ownerScopeKey,
          partitionId,
          currentGeneration: 1,
          updatedAt: now,
        }),
      ),
      expiresAt: now - 1,
    });
    expect(
      decodeHomeDisplaySnapshotRoute({
        raw: legacyRouteRaw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedPartitionId: partitionId,
      }),
    ).toMatchObject({
      currentGeneration: 1,
      ownerScopeKey,
    });
  });

  it('encodes one independently loadable source chunk without time expiry', () => {
    const portfolioPayload = {
      displayIds: ['asset-a'],
      isLpTokenSwitchLoading: true,
      ownerKey: 'owner-a',
      scopedLpTokenListState: {
        initialized: false,
        isRefreshing: true,
      },
    };
    const record = {
      sourceId: 'portfolio' as const,
      sourceKeyIdentity: 'portfolio-source',
      dataSchemaVersion: 1,
      coverageFingerprint: '["asset-a"]',
      quoteBasis: null,
      confirmedAt: now,
      expiresAt: now + 1,
      payload: {
        payload: portfolioPayload,
        section: {
          kind: 'ready' as const,
          rowIds: ['asset-a'],
        },
      },
    };
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey,
      record,
    });
    const decoded = decodeHomeDisplaySnapshotSourceChunk({
      raw,
      expectedOwnerScopeKey: ownerScopeKey,
      expectedSourceId: 'portfolio',
    });
    expect(decoded).toMatchObject({
      ...record,
      confirmedAt: 0,
      expiresAt: Number.MAX_SAFE_INTEGER,
      payload: {
        payload: {
          isLpTokenSwitchLoading: false,
          ownerKey: 'owner-a',
          scopedLpTokenListState: {
            initialized: true,
            isRefreshing: false,
          },
        },
      },
    });
    expect(raw).not.toContain('isLpTokenSwitchLoading');
    expect(raw).not.toContain('scopedLpTokenListState');
    expect(
      decodeHomeDisplaySnapshotSourceChunk({
        raw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedSourceId: 'history',
      }),
    ).toBeUndefined();
  });

  it('restores History interaction fields from defaults instead of disk', () => {
    const record = {
      sourceId: 'history' as const,
      sourceKeyIdentity: 'history-source',
      dataSchemaVersion: 2,
      coverageFingerprint: '[]',
      quoteBasis: null,
      confirmedAt: now,
      expiresAt: now + 1,
      payload: {
        payload: {
          addressMap: {},
          cursor: null,
          data: [],
          hasMore: false,
          isLoadingMore: true,
          refresh: 'failed',
          tokenMap: {},
        },
        section: {
          kind: 'ready' as const,
          rowIds: [],
        },
      },
    };
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey,
      record,
    });
    const decoded = decodeHomeDisplaySnapshotSourceChunk({
      raw,
      expectedOwnerScopeKey: ownerScopeKey,
      expectedSourceId: 'history',
    });

    expect(raw).not.toContain('isLoadingMore');
    expect(raw).not.toContain('"refresh"');
    expect(decoded).toMatchObject({
      payload: {
        payload: {
          isLoadingMore: false,
          refresh: 'refreshing',
        },
      },
    });
  });

  it('keeps the complete bounded Portfolio display projection without hidden token details', () => {
    const tokens = Array.from({ length: 80 }, (_, index) => ({
      $key: `token-${index}`,
      accountId: 'account-a',
      address: `0x${index}`,
      balanceParsed: '1',
      decimals: 18,
      name: `Token ${index}`,
      networkId: `network-${index % 2}`,
      symbol: `T${index}`,
    }));
    const smallBalanceTokens = Array.from({ length: 600 }, (_, index) => ({
      ...tokens[0],
      $key: `small-token-${index}`,
      name: `Hidden small token marker ${index}`,
    }));
    const riskTokens = Array.from({ length: 400 }, (_, index) => ({
      ...tokens[0],
      $key: `risk-token-${index}`,
      name: `Hidden risk token marker ${index}`,
    }));
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey,
      record: {
        confirmedAt: now,
        coverageFingerprint: 'portfolio-large',
        dataSchemaVersion: 3,
        expiresAt: now + 1,
        payload: {
          payload: {
            accountTokensValue: '123.45',
            accountTokensWorthCurrency: 'USD',
            blockedRiskTokenCount: 9,
            displayIds: tokens.map((token) => token.$key),
            fundedIds: tokens.map((token) => token.$key),
            generation: 2,
            networksMap: {
              'network-0': { id: 'network-0', name: 'Network 0' },
              'network-1': { id: 'network-1', name: 'Network 1' },
              'network-unused': { id: 'network-unused', name: 'Unused' },
            },
            ownerKey: 'owner-large',
            riskMap: Object.fromEntries(
              riskTokens.map((token) => [token.$key, { fiatValue: '1' }]),
            ),
            riskTokens,
            showLpTokenFilterSwitch: true,
            showLpTokensOnly: false,
            smallBalanceFiatValue: '12.34',
            smallBalanceMap: Object.fromEntries(
              smallBalanceTokens.map((token) => [
                token.$key,
                { fiatValue: '0.01' },
              ]),
            ),
            smallBalanceTokens,
            tapTokenMap: Object.fromEntries(
              tokens.map((token) => [token.$key, { fiatValue: '1' }]),
            ),
            tokenListMap: Object.fromEntries(
              tokens.map((token) => [
                token.$key,
                {
                  balanceParsed: '1',
                  currency: 'usd',
                  fiatValue: '1',
                  price: '1',
                  price24h: '1',
                },
              ]),
            ),
            tokens,
          },
          section: {
            kind: 'ready',
            rowIds: tokens.map((token) => token.$key),
          },
        },
        quoteBasis: { currency: 'USD' },
        sourceId: 'portfolio',
        sourceKeyIdentity: 'portfolio-large-source',
      },
    });
    const decoded = decodeHomeDisplaySnapshotSourceChunk({
      expectedOwnerScopeKey: ownerScopeKey,
      expectedSourceId: 'portfolio',
      raw,
    });
    const payload = (
      decoded?.payload as {
        payload: {
          displayIds: string[];
          networksMap: Record<string, unknown>;
          riskTokenCount: number;
          riskTokens: unknown[];
          smallBalanceTokenCount: number;
          smallBalanceTokens: unknown[];
          tokenListMap: Record<string, unknown>;
          tokens: unknown[];
        };
        section: { rowIds: string[] };
      }
    )?.payload;

    expect(raw).toBeDefined();
    expect(raw).not.toContain('Hidden small token marker');
    expect(raw).not.toContain('Hidden risk token marker');
    expect(raw).not.toContain('network-unused');
    expect(payload.tokens).toHaveLength(50);
    expect(payload.displayIds).toHaveLength(50);
    expect(payload.tokenListMap).toHaveProperty('token-49');
    expect(payload.tokenListMap).not.toHaveProperty('token-50');
    expect(payload.smallBalanceTokenCount).toBe(600);
    expect(payload.riskTokenCount).toBe(400);
    expect(payload.smallBalanceTokens).toEqual([]);
    expect(payload.riskTokens).toEqual([]);
    expect(
      (
        decoded?.payload as {
          section: { rowIds: string[] };
        }
      ).section.rowIds,
    ).toEqual(payload.displayIds);
  });

  it('persists only the Market rows needed by the native Home display', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      chainId: 'evm--1',
      contractAddress: `0x${index}`,
      marker: `market-row-${index}`,
    }));
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey,
      record: {
        confirmedAt: now,
        coverageFingerprint: 'market-large',
        dataSchemaVersion: 2,
        expiresAt: now + 1,
        payload: {
          payload: {
            categories: [{ id: 'favorites', name: 'Favorites' }],
            earnRows: Array.from({ length: 9 }, (_, index) => ({
              marker: `earn-${index}`,
            })),
            favoriteMode: 'favorites',
            perpsHotRows: Array.from({ length: 8 }, (_, index) => ({
              chainId: '',
              contractAddress: '',
              marker: `perps-${index}`,
              perpsCoin: `COIN${index}`,
            })),
            prefetchCategoryIds: ['trending'],
            prefetchedRowsByRequestKey: {
              trending: [{ ...rows[0], marker: 'prefetched-token-marker' }],
            },
            resolvedCategoryId: 'favorites',
            rows,
            selectedCategoryId: 'favorites',
            totalFavorites: 10,
            watchListContentKey: 'watch-list',
            watchListItems: rows.map((row) => ({
              chainId: row.chainId,
              contractAddress: row.contractAddress,
            })),
          },
          section: {
            kind: 'ready',
            rowIds: rows.map(
              (row) => `spot:${row.chainId}:${row.contractAddress}`,
            ),
          },
        },
        quoteBasis: null,
        sourceId: 'market',
        sourceKeyIdentity: 'market-source',
      },
    });
    const decoded = decodeHomeDisplaySnapshotSourceChunk({
      expectedOwnerScopeKey: ownerScopeKey,
      expectedSourceId: 'market',
      raw,
    });
    const payload = (
      decoded?.payload as {
        payload: {
          earnRows: unknown[];
          perpsHotRows: unknown[];
          prefetchCategoryIds: string[];
          prefetchedRowsByRequestKey: Record<string, unknown>;
          rows: unknown[];
          watchListItems: unknown[];
        };
      }
    )?.payload;

    expect(raw).toBeDefined();
    expect(raw).not.toContain('prefetched-token-marker');
    expect(payload.rows).toHaveLength(4);
    expect(payload.perpsHotRows).toHaveLength(5);
    expect(payload.earnRows).toHaveLength(6);
    expect(payload.watchListItems).toHaveLength(4);
    expect(payload.prefetchCategoryIds).toEqual([]);
    expect(payload.prefetchedRowsByRequestKey).toEqual({});
  });

  it('round-trips allowlisted banner data without a source-specific validator', () => {
    const payload = {
      banners: [{ id: 'banner-a' }],
      referralEligibility: null,
      tronResource: {
        accountId: 'account-a',
        networkId: 'network-tron',
      },
      isBotWalletReceiveBlocked: false,
    };
    const record = {
      sourceId: 'banner' as const,
      sourceKeyIdentity: 'banner-source',
      dataSchemaVersion: 1,
      coverageFingerprint: buildHomeBannerCoverageFingerprint({
        bannerIds: ['banner-a'],
        hasTronResource: true,
      }),
      quoteBasis: null,
      confirmedAt: now,
      expiresAt: now + 1,
      payload,
    };
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey,
      record,
    });

    expect(raw).toBeDefined();
    expect(
      decodeHomeDisplaySnapshotSourceChunk({
        raw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedSourceId: 'banner',
      }),
    ).toMatchObject({
      ...record,
      confirmedAt: 0,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
    expect(
      encodeHomeDisplaySnapshotSourceChunk({
        ownerScopeKey,
        record: {
          ...record,
          coverageFingerprint: buildHomeBannerCoverageFingerprint({
            bannerIds: ['banner-a'],
            hasTronResource: false,
          }),
        },
      }),
    ).toBeDefined();
  });

  it('allows an incremental manifest to reference unchanged older chunks', () => {
    const criticalRaw = '{"critical":true}';
    const portfolioRaw = '{"portfolio":true}';
    const manifestRaw = encodeHomeDisplaySnapshotManifest({
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      ownerScopeKey,
      partitionId,
      generation: 3,
      createdAt: now,
      chunks: {
        critical: createHomeDisplaySnapshotDescriptor({
          chunkId: 'critical',
          contentSignature: 'critical',
          generation: 3,
          partitionId,
          raw: criticalRaw,
          updatedAt: now,
        }),
        portfolio: createHomeDisplaySnapshotDescriptor({
          chunkId: 'portfolio',
          contentSignature: 'portfolio',
          generation: 1,
          partitionId,
          raw: portfolioRaw,
          updatedAt: now,
        }),
      },
    });
    const manifest = decodeHomeDisplaySnapshotManifest({
      raw: manifestRaw,
      expectedOwnerScopeKey: ownerScopeKey,
      expectedPartitionId: partitionId,
      expectedGeneration: 3,
    });
    expect(manifest?.chunks.critical?.key).toContain('/3/critical');
    expect(manifest?.chunks.portfolio?.key).toContain('/1/portfolio');
  });
});
