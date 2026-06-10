import deviceUtils from './deviceUtils';

jest.mock('../hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({
    getDeviceBootloaderVersion: jest.fn(() => []),
    getDeviceFirmwareVersion: jest.fn(() => []),
  })),
}));

describe('deviceUtils', () => {
  it('does not read third-party firmware versions from OneKey device helpers', async () => {
    await expect(
      deviceUtils.getDeviceVersion({
        device: undefined,
        features: {
          vendor: 'trezor',
          third_party_firmware_version: '2.8.0',
        } as never,
      }),
    ).resolves.toMatchObject({
      firmwareVersion: '',
    });
  });
});
