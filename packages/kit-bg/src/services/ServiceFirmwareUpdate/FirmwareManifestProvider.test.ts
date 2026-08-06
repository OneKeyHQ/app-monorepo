import { fetchFirmwareConfig } from '@onekeyhq/shared/src/hardware/firmwareConfigProvider';

import {
  FIRMWARE_MANIFEST_CACHE_TTL_MS,
  clearFirmwareManifestSnapshotCache,
  getFirmwareManifestSnapshot,
} from './FirmwareManifestProvider';
import { getTrustedFirmwareConfig } from './trustedFirmwareCatalog';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/hardware/firmwareConfigProvider', () => ({
  fetchFirmwareConfig: jest.fn(),
}));

jest.mock('./trustedFirmwareCatalog', () => ({
  getTrustedFirmwareConfig: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
      },
    },
  },
}));

const mockedFetchFirmwareConfig = fetchFirmwareConfig as jest.Mock;
const mockedGetTrustedFirmwareConfig = getTrustedFirmwareConfig as jest.Mock;
const remoteConfig = {
  bridge: { version: 'remote' },
} as unknown as RemoteConfigResponse;
const bundledConfig = {
  bridge: { version: 'bundled' },
} as unknown as RemoteConfigResponse;
describe('FirmwareManifestProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFirmwareManifestSnapshotCache();
    mockedGetTrustedFirmwareConfig.mockResolvedValue(bundledConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the App-fetched remote snapshot', async () => {
    mockedFetchFirmwareConfig.mockResolvedValue(remoteConfig);

    await expect(
      getFirmwareManifestSnapshot({ preRelease: false }),
    ).resolves.toBe(remoteConfig);
  });

  it.each([null, new Error('transport failed')])(
    'uses the bundled trusted snapshot without a remote or cache for %s',
    async (remoteResult) => {
      if (remoteResult instanceof Error) {
        mockedFetchFirmwareConfig.mockRejectedValue(remoteResult);
      } else {
        mockedFetchFirmwareConfig.mockResolvedValue(remoteResult);
      }

      await expect(
        getFirmwareManifestSnapshot({ preRelease: true }),
      ).resolves.toBe(bundledConfig);
      expect(mockedGetTrustedFirmwareConfig).toHaveBeenCalledWith({
        preRelease: true,
      });
    },
  );

  it('accepts the existing config shape without optional integrity fields', async () => {
    const config = {
      ...remoteConfig,
      pro: {
        'firmware-v8': [
          {
            required: false,
            version: [4, 21, 0],
            url: 'https://firmware.example/pro.bin',
            fingerprint: '',
            changelog: {},
          },
        ],
      },
    } as unknown as RemoteConfigResponse;
    mockedFetchFirmwareConfig.mockResolvedValue(config);

    await expect(
      getFirmwareManifestSnapshot({ preRelease: false }),
    ).resolves.toBe(config);
  });

  it('reuses a snapshot only within the fixed refresh interval', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const refreshedConfig = {
      bridge: { version: 'refreshed' },
    } as unknown as RemoteConfigResponse;
    mockedFetchFirmwareConfig
      .mockResolvedValueOnce(remoteConfig)
      .mockResolvedValueOnce(refreshedConfig);

    await expect(
      getFirmwareManifestSnapshot({ preRelease: false }),
    ).resolves.toBe(remoteConfig);
    await expect(
      getFirmwareManifestSnapshot({ preRelease: false }),
    ).resolves.toBe(remoteConfig);
    expect(mockedFetchFirmwareConfig).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS);
    await expect(
      getFirmwareManifestSnapshot({ preRelease: false }),
    ).resolves.toBe(refreshedConfig);
    expect(mockedFetchFirmwareConfig).toHaveBeenCalledTimes(2);
  });

  it('forces a network refresh before an explicit firmware check', async () => {
    const refreshedConfig = {
      bridge: { version: 'refreshed' },
    } as unknown as RemoteConfigResponse;
    mockedFetchFirmwareConfig
      .mockResolvedValueOnce(remoteConfig)
      .mockResolvedValueOnce(refreshedConfig);

    await getFirmwareManifestSnapshot({ preRelease: false });
    await expect(
      getFirmwareManifestSnapshot({
        preRelease: false,
        forceRefresh: true,
      }),
    ).resolves.toBe(refreshedConfig);
    expect(mockedFetchFirmwareConfig).toHaveBeenCalledTimes(2);
  });

  it('keeps the last known-good snapshot when a refresh fails', async () => {
    mockedFetchFirmwareConfig
      .mockResolvedValueOnce(remoteConfig)
      .mockRejectedValueOnce(new Error('transport failed'));

    await getFirmwareManifestSnapshot({ preRelease: true });
    await expect(
      getFirmwareManifestSnapshot({
        preRelease: true,
        forceRefresh: true,
      }),
    ).resolves.toBe(remoteConfig);
  });
});
