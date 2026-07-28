import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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

type ITrustedFirmwareCatalogModule =
  typeof import('./trustedFirmwareCatalog.generated');

let trustedFirmwareCatalogPromise:
  | Promise<ITrustedFirmwareCatalogModule>
  | undefined;

const loadTrustedFirmwareCatalog =
  (): Promise<ITrustedFirmwareCatalogModule> => {
    trustedFirmwareCatalogPromise ??=
      import('./trustedFirmwareCatalog.generated');
    return trustedFirmwareCatalogPromise;
  };

export async function getTrustedFirmwareConfig({
  preRelease,
}: {
  preRelease: boolean;
}): Promise<RemoteConfigResponse> {
  const { trustedPreReleaseFirmwareConfig, trustedStableFirmwareConfig } =
    await loadTrustedFirmwareCatalog();
  return preRelease
    ? trustedPreReleaseFirmwareConfig
    : trustedStableFirmwareConfig;
}

export async function getTrustedFirmwareArtifact(
  url: string,
): Promise<ITrustedFirmwareArtifact> {
  const { trustedFirmwareCatalog } = await loadTrustedFirmwareCatalog();
  const artifactsByUrl =
    trustedFirmwareCatalog.artifactsByUrl as unknown as Readonly<
      Record<string, ITrustedFirmwareArtifact>
    >;
  const artifact = artifactsByUrl[url];
  if (!artifact) {
    throw new OneKeyLocalError(
      'Firmware artifact is not admitted by the bundled catalog',
    );
  }
  return artifact;
}
