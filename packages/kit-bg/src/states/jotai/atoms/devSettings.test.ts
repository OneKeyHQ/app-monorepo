import {
  devSettingsPersistAtom,
  firmwareUpdateDevSettingsPersistAtom,
  getGatedFirmwareUpdateDevSetting,
} from './devSettings';

jest.mock('../utils', () => ({
  globalAtom: jest.fn(() => ({
    target: { get: jest.fn(), set: jest.fn() },
    use: jest.fn(),
  })),
  globalAtomComputed: jest.fn(() => ({ target: {}, use: jest.fn() })),
  globalAtomComputedRW: jest.fn(() => ({ target: {}, use: jest.fn() })),
}));

const mockedDevSettings = jest.mocked(devSettingsPersistAtom.get);
const mockedFirmwareDevSettings = jest.mocked(
  firmwareUpdateDevSettingsPersistAtom.get,
);

describe('getGatedFirmwareUpdateDevSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the value only while global developer mode is enabled', async () => {
    mockedDevSettings.mockResolvedValue({ enabled: true, settings: {} });
    mockedFirmwareDevSettings.mockResolvedValue({
      usePreReleaseConfig: true,
    } as never);

    await expect(
      getGatedFirmwareUpdateDevSetting('usePreReleaseConfig'),
    ).resolves.toBe(true);
  });

  it('never leaks a stale value once developer mode is off', async () => {
    // The persisted firmware settings may still hold `true` from an earlier
    // session; the global gate must win.
    mockedDevSettings.mockResolvedValue({ enabled: false, settings: {} });
    mockedFirmwareDevSettings.mockResolvedValue({
      usePreReleaseConfig: true,
    } as never);

    await expect(
      getGatedFirmwareUpdateDevSetting('usePreReleaseConfig'),
    ).resolves.toBeUndefined();
    expect(mockedFirmwareDevSettings).not.toHaveBeenCalled();
  });

  it('returns undefined for a disabled firmware setting under developer mode', async () => {
    mockedDevSettings.mockResolvedValue({ enabled: true, settings: {} });
    mockedFirmwareDevSettings.mockResolvedValue({
      usePreReleaseConfig: false,
    } as never);

    await expect(
      getGatedFirmwareUpdateDevSetting('usePreReleaseConfig'),
    ).resolves.toBe(false);
  });
});
