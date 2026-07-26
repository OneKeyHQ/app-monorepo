import { createHash } from 'node:crypto';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  FIRMWARE_ARTIFACT_MAX_READ_BYTES,
  FirmwareArtifactStore,
} from './FirmwareArtifactStore';

import type {
  IFirmwareArtifactAdapterReceipt,
  IFirmwareArtifactStoreAdapter,
} from './FirmwareArtifactStore';
import type { IFirmwareArtifactRequirement } from './firmwareUpdateCoordinatorTypes';

const LARGE_PRO2_ARTIFACT_BYTES = 83_854_948;

const sha256ZeroBytes = (size: number) => {
  const hash = createHash('sha256');
  const reusableChunk = Buffer.alloc(FIRMWARE_ARTIFACT_MAX_READ_BYTES);
  let remaining = size;
  while (remaining > 0) {
    const length = Math.min(remaining, reusableChunk.byteLength);
    hash.update(
      length === reusableChunk.byteLength
        ? reusableChunk
        : reusableChunk.subarray(0, length),
    );
    remaining -= length;
  }
  return hash.digest('hex');
};

const createRequirement = ({
  size,
  sha256,
}: {
  size: number;
  sha256: string;
}): IFirmwareArtifactRequirement => ({
  artifactId: `pro2-firmware-${size}`,
  role: 'firmware',
  sourceUrls: ['https://web.onekey-asset.com/pro2/firmware.bin'],
  expectedSize: size,
  expectedSha256: sha256,
  integrity: 'catalog-trusted',
  container: {
    kind: 'raw',
  },
  target: 'firmware',
  targetVersion: '1.0.0',
  devicePathRule: {
    kind: 'none',
  },
  dependsOn: [],
});

const createVirtualZeroArtifactAdapter = ({
  size,
  sha256,
}: {
  size: number;
  sha256: string;
}) => {
  let maxObservedReadBytes = 0;
  let totalReadBytes = 0;
  let readCount = 0;
  const receipt: IFirmwareArtifactAdapterReceipt = {
    artifactRef: `virtual-zero-${size}`,
    size,
    sha256,
    immutableToken: `immutable-zero-${size}`,
  };
  const adapter: IFirmwareArtifactStoreAdapter = {
    getCapabilities: async () => ({
      firmwareArtifactProtocolVersion: 1,
      supportedRouteTypes: ['domain', 'pinnedIp'],
      supportsArchiveMaterialization: true,
      maxReadBytes: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
    }),
    downloadArtifact: async () => {
      throw new OneKeyLocalError('cache hit must avoid a network download');
    },
    getArtifactStatus: async () => ({
      state: 'completed',
      downloadedBytes: size,
      expectedSize: size,
      receipt,
    }),
    cancelDownload: async () => undefined,
    quarantineArtifact: async () => undefined,
    openArtifact: async () => ({
      readerId: `reader-zero-${size}`,
      size,
      immutableToken: receipt.immutableToken,
      maxReadBytes: FIRMWARE_ARTIFACT_MAX_READ_BYTES,
    }),
    readArtifact: async ({ offset, length }) => {
      if (
        length <= 0 ||
        length > FIRMWARE_ARTIFACT_MAX_READ_BYTES ||
        offset < 0 ||
        offset + length > size
      ) {
        throw new OneKeyLocalError(
          'artifact reader exceeded its bounded range',
        );
      }
      maxObservedReadBytes = Math.max(maxObservedReadBytes, length);
      totalReadBytes += length;
      readCount += 1;
      return new Uint8Array(length).buffer;
    },
    closeArtifact: async () => undefined,
    materializeArchive: async () => ({ artifacts: [] }),
    createLease: async () => ({ leaseRef: 'lease-large-artifact' }),
    retainArtifact: async () => undefined,
    releaseLease: async () => undefined,
    reconcileLeases: async () => undefined,
    sweepOrphans: async () => ({
      deletedFiles: 0,
      deletedBytes: 0,
    }),
  };
  return {
    adapter,
    getReadStats: () => ({
      maxObservedReadBytes,
      totalReadBytes,
      readCount,
    }),
  };
};

describe('large firmware artifact memory boundary', () => {
  it.each([
    ['4 MiB', 4 * 1024 * 1024],
    ['79+ MB Pro 2 artifact', LARGE_PRO2_ARTIFACT_BYTES],
  ])(
    'verifies the complete %s artifact without a full-buffer read',
    async (_label, size) => {
      const sha256 = sha256ZeroBytes(size);
      const requirement = createRequirement({ size, sha256 });
      const virtualArtifact = createVirtualZeroArtifactAdapter({
        size,
        sha256,
      });
      const store = new FirmwareArtifactStore(virtualArtifact.adapter);

      const stored = await store.downloadArtifact({
        leaseRef: 'lease-large-artifact',
        requirement,
        route: {
          type: 'pinnedIp',
          url: requirement.sourceUrls[0],
          resolvedIp: '203.0.113.20',
        },
      });

      expect(stored.adapterReceipt.size).toBe(size);
      expect(stored.adapterReceipt.sha256).toBe(sha256);
      expect(virtualArtifact.getReadStats()).toEqual({
        maxObservedReadBytes: Math.min(size, FIRMWARE_ARTIFACT_MAX_READ_BYTES),
        totalReadBytes: size,
        readCount: Math.ceil(size / FIRMWARE_ARTIFACT_MAX_READ_BYTES),
      });
    },
    30_000,
  );
});
