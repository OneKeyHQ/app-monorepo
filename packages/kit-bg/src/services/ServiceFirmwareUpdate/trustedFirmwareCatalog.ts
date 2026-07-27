import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createConfigFetcher } from '@onekeyhq/shared/src/hardware/configFetcher';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

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

const FIRMWARE_CONFIG_URLS = {
  stable: 'https://data.onekey.so/config.json',
  preRelease: 'https://data.onekey.so/pre-config.json',
} as const;

export function getTrustedFirmwareConfig({
  preRelease,
}: {
  preRelease: boolean;
}): RemoteConfigResponse {
  return preRelease
    ? trustedPreReleaseFirmwareConfig
    : trustedStableFirmwareConfig;
}

export async function loadTrustedFirmwareConfig({
  preRelease,
}: {
  preRelease: boolean;
}): Promise<RemoteConfigResponse> {
  const bundledConfig = getTrustedFirmwareConfig({ preRelease });
  const fetchConfig = await createConfigFetcher();
  if (!fetchConfig) {
    return bundledConfig;
  }
  try {
    const remoteConfig = await fetchConfig(
      preRelease
        ? FIRMWARE_CONFIG_URLS.preRelease
        : FIRMWARE_CONFIG_URLS.stable,
    );
    if (
      remoteConfig &&
      stringUtils.stableStringify(remoteConfig) ===
        stringUtils.stableStringify(bundledConfig)
    ) {
      return remoteConfig;
    }
  } catch {
    return bundledConfig;
  }
  return bundledConfig;
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
