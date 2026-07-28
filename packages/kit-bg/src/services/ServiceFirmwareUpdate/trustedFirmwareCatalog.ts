import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  trustedFirmwareCatalog,
  trustedPreReleaseFirmwareConfig,
  trustedStableFirmwareConfig,
} from './trustedFirmwareCatalog.generated';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

export type ITrustedFirmwareArchiveEntry = {
  artifactId: string;
  entryName: string;
  expectedSize: number;
  expectedSha256: string;
};

export type ITrustedFirmwareArtifact = {
  url: string;
  role:
    | 'firmware'
    | 'ble'
    | 'bootloader'
    | 'resource'
    | 'fullResource'
    | 'component'
    | 'resourceBundle';
  logicalName?: string;
  expectedSize: number;
  expectedSha256: string;
  container: 'raw' | 'zip';
  expectedEntries?: readonly ITrustedFirmwareArchiveEntry[];
};

const artifactsByUrl =
  trustedFirmwareCatalog.artifactsByUrl as unknown as Readonly<
    Record<string, ITrustedFirmwareArtifact>
  >;

export function getTrustedFirmwareConfig({
  preRelease,
}: {
  preRelease: boolean;
}): RemoteConfigResponse {
  return preRelease
    ? trustedPreReleaseFirmwareConfig
    : trustedStableFirmwareConfig;
}

export function getTrustedFirmwareArtifact(
  url: string,
): ITrustedFirmwareArtifact {
  const artifact = artifactsByUrl[url];
  if (!artifact) {
    throw new OneKeyLocalError(
      'Firmware artifact is not admitted by the bundled catalog',
    );
  }
  return artifact;
}

export function getTrustedFirmwareArtifactByIntegrity({
  expectedSha256,
  expectedSize,
  role,
  container,
  logicalName,
}: {
  expectedSha256: string;
  expectedSize: number;
  role: ITrustedFirmwareArtifact['role'];
  container: ITrustedFirmwareArtifact['container'];
  logicalName?: string;
}): ITrustedFirmwareArtifact {
  const normalizedSha256 = expectedSha256.toLowerCase();
  const match = Object.values(artifactsByUrl).find(
    (artifact) =>
      artifact.expectedSha256.toLowerCase() === normalizedSha256 &&
      artifact.expectedSize === expectedSize &&
      artifact.container === container &&
      artifact.logicalName === logicalName &&
      (artifact.role === role ||
        (role === 'resource' && artifact.role === 'fullResource')),
  );
  if (!match) {
    throw new OneKeyLocalError(
      'Firmware artifact is not admitted by the bundled catalog',
    );
  }
  return match;
}
