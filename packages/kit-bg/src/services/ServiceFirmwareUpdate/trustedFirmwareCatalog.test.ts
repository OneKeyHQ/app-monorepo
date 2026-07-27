import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createConfigFetcher } from '@onekeyhq/shared/src/hardware/configFetcher';

import {
  getTrustedFirmwareConfig,
  loadTrustedFirmwareConfig,
} from './trustedFirmwareCatalog';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/hardware/configFetcher', () => ({
  createConfigFetcher: jest.fn(),
}));

jest.mock('./trustedFirmwareCatalog.generated', () => {
  const deviceConfig = { firmware: [], ble: [] };
  const stable = {
    bridge: { version: [1, 0, 0] },
    classic: deviceConfig,
    classic1s: deviceConfig,
    classicpure: deviceConfig,
    mini: deviceConfig,
    touch: deviceConfig,
    pro: deviceConfig,
    pro2: deviceConfig,
  };
  const preRelease = {
    ...stable,
    bridge: { version: [2, 0, 0] },
  };
  return {
    trustedFirmwareCatalog: { artifactsByUrl: {} },
    trustedStableFirmwareConfig: stable,
    trustedPreReleaseFirmwareConfig: preRelease,
  };
});

const mockedCreateConfigFetcher = createConfigFetcher as jest.Mock;

describe('trusted firmware config loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a remote config only when it matches the bundled snapshot', async () => {
    const bundled = getTrustedFirmwareConfig({ preRelease: false });
    const remote = structuredClone(bundled);
    const fetchConfig = jest.fn(async () => remote);
    mockedCreateConfigFetcher.mockResolvedValue(fetchConfig);

    await expect(
      loadTrustedFirmwareConfig({ preRelease: false }),
    ).resolves.toBe(remote);
    expect(fetchConfig).toHaveBeenCalledWith(
      'https://data.onekey.so/config.json',
    );
  });

  it('falls back to bundled config when the remote snapshot differs', async () => {
    const bundled = getTrustedFirmwareConfig({ preRelease: false });
    const remote = {
      ...structuredClone(bundled),
      classic: { firmware: [{ version: [9, 9, 9] }], ble: [] },
    } as unknown as RemoteConfigResponse;
    mockedCreateConfigFetcher.mockResolvedValue(jest.fn(async () => remote));

    await expect(
      loadTrustedFirmwareConfig({ preRelease: false }),
    ).resolves.toBe(bundled);
  });

  it('falls back to the pre-release bundle on transport failure', async () => {
    const bundled = getTrustedFirmwareConfig({ preRelease: true });
    const fetchConfig = jest.fn(async () => {
      throw new OneKeyLocalError('offline');
    });
    mockedCreateConfigFetcher.mockResolvedValue(fetchConfig);

    await expect(loadTrustedFirmwareConfig({ preRelease: true })).resolves.toBe(
      bundled,
    );
    expect(fetchConfig).toHaveBeenCalledWith(
      'https://data.onekey.so/pre-config.json',
    );
  });
});
