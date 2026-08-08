import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { fetchFirmwareConfig } from '@onekeyhq/shared/src/hardware/firmwareConfigProvider';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

export const FIRMWARE_MANIFEST_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

type IFirmwareManifestCacheEntry = {
  config: RemoteConfigResponse;
  expiresAt: number;
};

const firmwareManifestCache = new Map<boolean, IFirmwareManifestCacheEntry>();
const firmwareManifestRefreshes = new Map<
  boolean,
  Promise<RemoteConfigResponse>
>();

export function clearFirmwareManifestSnapshotCache(): void {
  firmwareManifestCache.clear();
  firmwareManifestRefreshes.clear();
}

async function refreshFirmwareManifestSnapshot({
  preRelease,
}: {
  preRelease: boolean;
}): Promise<RemoteConfigResponse> {
  const cached = firmwareManifestCache.get(preRelease);
  try {
    const remoteConfig = await fetchFirmwareConfig({ preRelease });
    if (remoteConfig) {
      firmwareManifestCache.set(preRelease, {
        config: remoteConfig,
        expiresAt: Date.now() + FIRMWARE_MANIFEST_CACHE_TTL_MS,
      });
      return remoteConfig;
    }
  } catch {
    // Keep using the last known-good remote snapshot below.
  }

  if (cached) {
    defaultLogger.ipTable.request.info({
      info: '[FirmwareManifest] config_fetch route=cache outcome=stale_fallback',
    });
    return cached.config;
  }

  throw new OneKeyLocalError('Firmware manifest is unavailable');
}

export async function getFirmwareManifestSnapshot({
  preRelease,
  forceRefresh = false,
}: {
  preRelease: boolean;
  forceRefresh?: boolean;
}): Promise<RemoteConfigResponse> {
  const cached = firmwareManifestCache.get(preRelease);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const pendingRefresh = firmwareManifestRefreshes.get(preRelease);
  if (pendingRefresh) {
    return pendingRefresh;
  }

  const refresh = refreshFirmwareManifestSnapshot({ preRelease }).finally(
    () => {
      firmwareManifestRefreshes.delete(preRelease);
    },
  );
  firmwareManifestRefreshes.set(preRelease, refresh);
  return refresh;
}
