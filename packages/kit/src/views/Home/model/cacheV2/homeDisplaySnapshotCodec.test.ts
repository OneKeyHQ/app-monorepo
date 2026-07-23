import {
  createHomeDisplaySnapshotDescriptor,
  decodeHomeDisplaySnapshotCritical,
  decodeHomeDisplaySnapshotManifest,
  decodeHomeDisplaySnapshotSourceChunk,
  encodeHomeDisplaySnapshotCritical,
  encodeHomeDisplaySnapshotManifest,
  encodeHomeDisplaySnapshotSourceChunk,
} from './homeDisplaySnapshotCodec';
import {
  getHomeDisplaySnapshotChunkKey,
  getHomeDisplaySnapshotPartitionId,
  getHomeDisplaySnapshotPartitionTag,
} from './homeDisplaySnapshotKeys';
import {
  HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
  HOME_DISPLAY_SNAPSHOT_TTL_MS,
} from './homeDisplaySnapshotTypes';

const ownerScopeKey = 'wallet-a:account-a:network-eth';
const partitionId = getHomeDisplaySnapshotPartitionId(ownerScopeKey);
const now = 1000;
const expiresAt = now + HOME_DISPLAY_SNAPSHOT_TTL_MS;

describe('Home display snapshot V2 codec', () => {
  it('uses a deterministic opaque partition id and validates critical TTL', () => {
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
      expiresAt,
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
          freshness: 'confirmedCache',
          refresh: 'refreshing',
        },
      },
      selectedTabPreference: 'portfolio',
    });
    expect(
      decodeHomeDisplaySnapshotCritical({
        raw,
        expectedOwnerScopeKey: ownerScopeKey,
        now,
      }),
    ).toMatchObject({
      ownerScopeKey,
      selectedTabPreference: 'portfolio',
    });
    expect(
      decodeHomeDisplaySnapshotCritical({
        raw,
        expectedOwnerScopeKey: ownerScopeKey,
        now: expiresAt,
      }),
    ).toBeUndefined();
  });

  it('encodes and admits one independently loadable source chunk', () => {
    const key = getHomeDisplaySnapshotChunkKey(partitionId, 1, 'portfolio');
    const record = {
      sourceId: 'portfolio' as const,
      sourceKeyIdentity: 'portfolio-source',
      dataSchemaVersion: 1,
      coverageFingerprint: '["asset-a"]',
      quoteBasis: null,
      confirmedAt: now,
      expiresAt,
      payload: {
        section: {
          kind: 'ready' as const,
          rowIds: ['asset-a'],
        },
      },
    };
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      key,
      ownerScopeKey,
      record,
      createdAt: now,
      expiresAt,
    });
    expect(
      decodeHomeDisplaySnapshotSourceChunk({
        raw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedSourceId: 'portfolio',
        now,
      }),
    ).toEqual(record);
    expect(
      decodeHomeDisplaySnapshotSourceChunk({
        raw,
        expectedOwnerScopeKey: ownerScopeKey,
        expectedSourceId: 'history',
        now,
      }),
    ).toBeUndefined();
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
      expiresAt,
      chunks: {
        critical: createHomeDisplaySnapshotDescriptor({
          chunkId: 'critical',
          contentSignature: 'critical',
          expiresAt,
          generation: 3,
          partitionId,
          raw: criticalRaw,
          updatedAt: now,
        }),
        portfolio: createHomeDisplaySnapshotDescriptor({
          chunkId: 'portfolio',
          contentSignature: 'portfolio',
          expiresAt,
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
      now,
    });
    expect(manifest?.chunks.critical?.key).toContain('/3/critical');
    expect(manifest?.chunks.portfolio?.key).toContain('/1/portfolio');
  });
});
