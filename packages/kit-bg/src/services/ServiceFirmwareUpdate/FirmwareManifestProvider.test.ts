import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { fetchFirmwareConfig } from '@onekeyhq/shared/src/hardware/firmwareConfigProvider';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  FIRMWARE_MANIFEST_CACHE_TTL_MS,
  clearFirmwareManifestSnapshotCache,
  getFirmwareManifestSnapshot,
} from './FirmwareManifestProvider';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/hardware/firmwareConfigProvider', () => ({
  fetchFirmwareConfig: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => `localized:${id}` },
  },
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
const remoteConfig = {
  bridge: { version: 'remote' },
} as unknown as RemoteConfigResponse;
const manifestUnavailableError = {
  key: ETranslations.firmware_info_unavailable__msg,
  message: `localized:${ETranslations.firmware_info_unavailable__msg}`,
  className: EOneKeyErrorClassNames.OneKeyLocalError,
};
describe('FirmwareManifestProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFirmwareManifestSnapshotCache();
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
    'fails closed without a remote or cached snapshot for %s',
    async (remoteResult) => {
      const logInfoSpy = jest.spyOn(defaultLogger.ipTable.request, 'info');
      if (remoteResult instanceof Error) {
        mockedFetchFirmwareConfig.mockRejectedValue(remoteResult);
      } else {
        mockedFetchFirmwareConfig.mockResolvedValue(remoteResult);
      }

      await expect(
        getFirmwareManifestSnapshot({ preRelease: true, forceRefresh: true }),
      ).rejects.toMatchObject(manifestUnavailableError);
      expect(logInfoSpy).toHaveBeenCalledWith({
        info: '[FirmwareManifest] config_fetch route=none outcome=unavailable',
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

  it.each([null, new Error('transport failed')])(
    'falls back to an unexpired snapshot without extending its TTL for %s',
    async (remoteResult) => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
      const logInfoSpy = jest.spyOn(defaultLogger.ipTable.request, 'info');
      mockedFetchFirmwareConfig.mockResolvedValueOnce(remoteConfig);
      if (remoteResult instanceof Error) {
        mockedFetchFirmwareConfig.mockRejectedValue(remoteResult);
      } else {
        mockedFetchFirmwareConfig.mockResolvedValue(remoteResult);
      }

      await getFirmwareManifestSnapshot({ preRelease: false });
      nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS / 2);
      await expect(
        getFirmwareManifestSnapshot({ preRelease: false, forceRefresh: true }),
      ).resolves.toBe(remoteConfig);
      expect(logInfoSpy).toHaveBeenCalledWith({
        info: '[FirmwareManifest] config_fetch route=cache outcome=fresh_fallback',
      });

      nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS);
      await expect(
        getFirmwareManifestSnapshot({ preRelease: false, forceRefresh: true }),
      ).rejects.toMatchObject(manifestUnavailableError);
    },
  );

  it('does not use an expired snapshot for an explicit firmware check', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockedFetchFirmwareConfig
      .mockResolvedValueOnce(remoteConfig)
      .mockRejectedValueOnce(new Error('transport failed'));

    await getFirmwareManifestSnapshot({ preRelease: true });
    nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS);
    await expect(
      getFirmwareManifestSnapshot({
        preRelease: true,
        forceRefresh: true,
      }),
    ).rejects.toMatchObject(manifestUnavailableError);
  });

  it('does not use a snapshot that expires while the forced refresh is pending', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockedFetchFirmwareConfig
      .mockResolvedValueOnce(remoteConfig)
      .mockImplementationOnce(() => {
        nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS);
        return Promise.resolve(null);
      });

    await getFirmwareManifestSnapshot({ preRelease: false });
    nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS - 1);
    await expect(
      getFirmwareManifestSnapshot({ preRelease: false, forceRefresh: true }),
    ).rejects.toMatchObject(manifestUnavailableError);
  });

  it.each([false, true])(
    'does not fall back to another release channel when preRelease=%s',
    async (preRelease) => {
      mockedFetchFirmwareConfig
        .mockResolvedValueOnce(remoteConfig)
        .mockResolvedValue(null);

      await getFirmwareManifestSnapshot({ preRelease: !preRelease });
      await expect(
        getFirmwareManifestSnapshot({ preRelease, forceRefresh: true }),
      ).rejects.toMatchObject(manifestUnavailableError);
    },
  );

  it('preserves stale fallback for non-forced initialization', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const logInfoSpy = jest.spyOn(defaultLogger.ipTable.request, 'info');
    mockedFetchFirmwareConfig
      .mockResolvedValueOnce(remoteConfig)
      .mockResolvedValueOnce(null);

    await getFirmwareManifestSnapshot({ preRelease: false });
    nowSpy.mockReturnValue(1000 + FIRMWARE_MANIFEST_CACHE_TTL_MS);
    await expect(
      getFirmwareManifestSnapshot({ preRelease: false }),
    ).resolves.toBe(remoteConfig);
    expect(logInfoSpy).toHaveBeenCalledWith({
      info: '[FirmwareManifest] config_fetch route=cache outcome=stale_fallback',
    });
  });
});
