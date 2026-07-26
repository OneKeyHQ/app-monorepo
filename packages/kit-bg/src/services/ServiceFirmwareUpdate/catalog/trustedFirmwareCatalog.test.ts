/* cspell:ignore codegen */
/* eslint-disable import-path/parent-depth */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  type ITrustedFirmwareCatalogSnapshot,
  sha256TrustedFirmwareJson,
} from '../../../../../../development/scripts/firmware/generateTrustedFirmwareCatalog';

import {
  trustedFirmwareCatalogMetadata,
  trustedFirmwareCatalogSnapshotJsonByKey,
} from './trustedFirmwareCatalog.generated';

type ITrustedSnapshot = ITrustedFirmwareCatalogSnapshot['snapshot'];

const ALLOWED_ARTIFACT_HOSTS = new Set([
  'common.onekey-asset.com',
  'web.onekey-asset.com',
]);

const parseSnapshot = (key: string): ITrustedSnapshot => {
  const payload = trustedFirmwareCatalogSnapshotJsonByKey[key];
  if (!payload) {
    throw new OneKeyLocalError(
      `Missing trusted firmware snapshot payload for ${key}`,
    );
  }
  const value: unknown = JSON.parse(payload);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OneKeyLocalError(
      `Invalid trusted firmware snapshot payload for ${key}`,
    );
  }
  return value as ITrustedSnapshot;
};

describe('trusted firmware catalog', () => {
  it('contains one lazy payload for every unique stable index key', () => {
    const indexKeys = trustedFirmwareCatalogMetadata.snapshotIndex.map(
      (entry) => entry.key,
    );
    expect(new Set(indexKeys).size).toBe(indexKeys.length);
    expect(
      Object.keys(trustedFirmwareCatalogSnapshotJsonByKey).toSorted(),
    ).toEqual(indexKeys.toSorted());
    expect(
      trustedFirmwareCatalogMetadata.snapshotIndex.every(
        (entry) =>
          entry.channel === 'stable' &&
          entry.catalogEpoch === trustedFirmwareCatalogMetadata.catalogEpoch &&
          entry.catalogLineage ===
            trustedFirmwareCatalogMetadata.catalogLineage &&
          /^[0-9a-f]{64}$/.test(entry.sourceSelectionDigest),
      ),
    ).toBe(true);
    expect(
      trustedFirmwareCatalogMetadata.sources.map((source) => source.channel),
    ).toEqual(['stable']);
  });

  it('reconstructs the reviewed catalog digest from lazy snapshots', () => {
    const snapshots = trustedFirmwareCatalogMetadata.snapshotIndex.map(
      ({ snapshotDigest, ...entry }) => {
        const snapshot = parseSnapshot(entry.key);
        expect(snapshot.snapshotDigest).toBe(snapshotDigest);
        expect(sha256TrustedFirmwareJson(snapshot.remoteConfigProjection)).toBe(
          entry.projectionDigest,
        );
        const { snapshotDigest: _snapshotDigest, ...snapshotDigestInput } =
          snapshot;
        expect(sha256TrustedFirmwareJson(snapshotDigestInput)).toBe(
          snapshotDigest,
        );
        return { ...entry, snapshot };
      },
    );
    expect(
      sha256TrustedFirmwareJson({
        schemaVersion: trustedFirmwareCatalogMetadata.schemaVersion,
        catalogLineage: trustedFirmwareCatalogMetadata.catalogLineage,
        catalogEpoch: trustedFirmwareCatalogMetadata.catalogEpoch,
        generatedAt: trustedFirmwareCatalogMetadata.generatedAt,
        sources: trustedFirmwareCatalogMetadata.sources,
        snapshots,
      }),
    ).toBe(trustedFirmwareCatalogMetadata.catalogDigest);
  });

  it('admits only exact HTTPS hosts and complete artifact relationships', () => {
    trustedFirmwareCatalogMetadata.snapshotIndex.forEach((entry) => {
      const snapshot = parseSnapshot(entry.key);
      const artifactsById = new Map(
        snapshot.artifactCatalog.map((artifact) => [
          artifact.artifactId,
          artifact,
        ]),
      );
      expect(artifactsById.size).toBe(snapshot.artifactCatalog.length);

      snapshot.artifactCatalog.forEach((artifact) => {
        expect(artifact.expectedSize).toBeGreaterThan(0);
        expect(artifact.expectedSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(artifact.sourceUrls.length).toBeGreaterThan(0);
        artifact.sourceUrls.forEach((sourceUrl) => {
          const parsed = new URL(sourceUrl);
          expect(parsed.protocol).toBe('https:');
          expect(parsed.username).toBe('');
          expect(parsed.password).toBe('');
          expect(parsed.port).toBe('');
          expect(ALLOWED_ARTIFACT_HOSTS.has(parsed.hostname)).toBe(true);
        });
        artifact.dependsOn.forEach((dependencyId) => {
          expect(artifactsById.has(dependencyId)).toBe(true);
        });
        if (artifact.container.kind === 'archive-entry') {
          expect(artifactsById.has(artifact.container.parentArtifactId)).toBe(
            true,
          );
        }
      });

      snapshot.releases.forEach((release) => {
        expect(new Set(release.artifactIds).size).toBe(
          release.artifactIds.length,
        );
        release.artifactIds.forEach((artifactId) => {
          expect(artifactsById.has(artifactId)).toBe(true);
        });
      });
    });
  });

  it('keeps the bundled catalog lazy instead of eagerly materializing all snapshots', () => {
    const payloadBytes = Object.values(
      trustedFirmwareCatalogSnapshotJsonByKey,
    ).reduce((total, payload) => total + Buffer.byteLength(payload), 0);
    expect(payloadBytes).toBeLessThan(2_100_000);
  });
});
