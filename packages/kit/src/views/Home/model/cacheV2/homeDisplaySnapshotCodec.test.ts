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

describe('Home display snapshot V3 codec', () => {
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
