import { buildHomeBannerCoverageFingerprint } from '../sections/banner/homeBannerStoreModel';

import {
  createHomeDisplaySnapshotDescriptor,
  decodeHomeDisplaySnapshotCritical,
  decodeHomeDisplaySnapshotManifest,
  decodeHomeDisplaySnapshotPortfolioDetails,
  decodeHomeDisplaySnapshotRoute,
  decodeHomeDisplaySnapshotRouteIndex,
  decodeHomeDisplaySnapshotSourceChunk,
  encodeHomeDisplaySnapshotCritical,
  encodeHomeDisplaySnapshotManifest,
  encodeHomeDisplaySnapshotPortfolioDetails,
  encodeHomeDisplaySnapshotRoute,
  encodeHomeDisplaySnapshotRouteIndex,
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
      ...JSON.parse(raw),
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
          freshness: 'confirmedCache',
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
      aggregateTokenListMap: {
        'asset-a': { tokens: [{ $key: 'aggregate-a' }] },
      },
      allAggregateTokenMap: {
        'hidden-a': { tokens: [{ $key: 'hidden-aggregate-a' }] },
      },
      displayIds: ['asset-a'],
      isLpTokenSwitchLoading: true,
      ownerKey: 'owner-a',
      riskMap: {
        'risk-a': { fiatValue: '1' },
      },
      riskTokens: [{ $key: 'risk-a' }],
      scopedLpTokenListState: {
        initialized: false,
        isRefreshing: true,
      },
      smallBalanceMap: {
        'small-a': { fiatValue: '2' },
      },
      smallBalanceTokens: [{ $key: 'small-a' }],
    };
    const record = {
      sourceId: 'portfolio' as const,
      sourceKeyIdentity: 'portfolio-source',
      dataSchemaVersion: 1,
      coverageFingerprint: '1:asset-a:asset-a',
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
    expect(raw).not.toContain('allAggregateTokenMap');
    expect(raw).not.toContain('riskMap');
    expect(raw).not.toContain('riskTokens');
    expect(raw).not.toContain('smallBalanceMap');
    expect(raw).not.toContain('smallBalanceTokens');
    expect(decoded).toMatchObject({
      payload: {
        payload: {
          riskTokenCount: 1,
          smallBalanceTokenCount: 1,
        },
      },
    });

    const detailsRaw = encodeHomeDisplaySnapshotPortfolioDetails({
      ownerScopeKey,
      record,
    });
    expect(detailsRaw).toContain('allAggregateTokenMap');
    expect(detailsRaw).toContain('riskTokens');
    expect(detailsRaw).toContain('smallBalanceTokens');
    expect(
      decodeHomeDisplaySnapshotPortfolioDetails({
        raw: detailsRaw,
        expectedOwnerScopeKey: ownerScopeKey,
      }),
    ).toMatchObject({
      ownerScopeKey,
      sourceKeyIdentity: 'portfolio-source',
      riskTokens: [{ $key: 'risk-a' }],
      smallBalanceTokens: [{ $key: 'small-a' }],
    });
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
      coverageFingerprint: '0::',
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

  it('accepts valid snapshots regardless of serialized byte size', () => {
    const largeValue = 'x'.repeat(1024 * 1024 + 1);
    const criticalRaw = encodeHomeDisplaySnapshotCritical({
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      ownerScopeKey,
      createdAt: now,
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'funded',
          header: {
            kind: 'funded',
            balance: { amount: largeValue, currency: 'USD' },
          },
          actions: { kind: 'funded', items: ['send'] },
          banner: { kind: 'none' },
        },
      },
    });
    expect(criticalRaw.length).toBeGreaterThan(1024 * 1024);
    expect(
      decodeHomeDisplaySnapshotCritical({
        raw: criticalRaw,
        expectedOwnerScopeKey: ownerScopeKey,
      }),
    ).toBeDefined();

    const sourceRaw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey,
      record: {
        sourceId: 'banner',
        sourceKeyIdentity: 'banner-source',
        dataSchemaVersion: 1,
        coverageFingerprint: 'large-banner',
        quoteBasis: null,
        confirmedAt: now,
        expiresAt: now + 1,
        payload: {
          banners: [{ id: largeValue }],
          referralEligibility: null,
          tronResource: null,
          isBotWalletReceiveBlocked: false,
        },
      },
    });
    expect(sourceRaw?.length).toBeGreaterThan(1024 * 1024);
    expect(
      decodeHomeDisplaySnapshotSourceChunk({
        raw: sourceRaw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedSourceId: 'banner',
      }),
    ).toBeDefined();

    const routeRaw = encodeHomeDisplaySnapshotRoute({
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      ownerScopeKey: largeValue,
      partitionId,
      currentGeneration: 1,
      updatedAt: now,
    });
    expect(routeRaw.length).toBeGreaterThan(16 * 1024);
    expect(
      decodeHomeDisplaySnapshotRoute({
        raw: routeRaw,
        expectedOwnerScopeKey: largeValue,
        expectedPartitionId: partitionId,
      }),
    ).toBeDefined();

    const manifestRaw = encodeHomeDisplaySnapshotManifest({
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      ownerScopeKey,
      partitionId,
      generation: 1,
      createdAt: now,
      chunks: {
        portfolio: createHomeDisplaySnapshotDescriptor({
          chunkId: 'portfolio',
          contentSignature: largeValue,
          generation: 1,
          partitionId,
          raw: '{"portfolio":true}',
          updatedAt: now,
        }),
      },
    });
    expect(manifestRaw.length).toBeGreaterThan(64 * 1024);
    expect(
      decodeHomeDisplaySnapshotManifest({
        raw: manifestRaw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedPartitionId: partitionId,
        expectedGeneration: 1,
      }),
    ).toBeDefined();

    const routeIndexRaw = encodeHomeDisplaySnapshotRouteIndex({
      schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
      routes: [{ partitionId: largeValue, lastAccessedAt: now }],
    });
    expect(routeIndexRaw.length).toBeGreaterThan(32 * 1024);
    expect(decodeHomeDisplaySnapshotRouteIndex(routeIndexRaw)).toBeDefined();
  });
});
