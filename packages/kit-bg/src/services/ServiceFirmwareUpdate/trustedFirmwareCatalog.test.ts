import {
  getTrustedFirmwareArtifact,
  getTrustedFirmwareConfig,
} from './trustedFirmwareCatalog';

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
  const artifact = {
    url: 'https://firmware.onekey.test/firmware.bin',
    role: 'firmware',
    expectedSize: 1024,
    expectedSha256: '1'.repeat(64),
    container: 'raw',
  };
  return {
    trustedFirmwareCatalog: {
      artifactsByUrl: { [artifact.url]: artifact },
    },
    trustedStableFirmwareConfig: stable,
    trustedPreReleaseFirmwareConfig: {
      ...stable,
      bridge: { version: [2, 0, 0] },
    },
  };
});

describe('trusted firmware catalog', () => {
  it('loads the bundled snapshot for the requested channel', async () => {
    await expect(
      getTrustedFirmwareConfig({ preRelease: false }),
    ).resolves.toMatchObject({ bridge: { version: [1, 0, 0] } });
    await expect(
      getTrustedFirmwareConfig({ preRelease: true }),
    ).resolves.toMatchObject({ bridge: { version: [2, 0, 0] } });
  });

  it('admits only exact catalog URLs', async () => {
    await expect(
      getTrustedFirmwareArtifact('https://firmware.onekey.test/firmware.bin'),
    ).resolves.toMatchObject({
      expectedSize: 1024,
      expectedSha256: '1'.repeat(64),
    });
    await expect(
      getTrustedFirmwareArtifact('https://firmware.onekey.test/unreviewed.bin'),
    ).rejects.toThrow('Firmware artifact is not admitted');
  });
});
