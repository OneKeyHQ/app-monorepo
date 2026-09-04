/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import { DeviceSettingsManager } from './DeviceSettingsManager';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice, IDBDeviceSettings } from '../../dbs/local/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({
  __esModule: true,
  default: { isMonochromeScreen: jest.fn(() => false) },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
    updateDeviceDbSettings: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: ({ id }: { id: string }) => id } },
}));

function buildDevice(settings: IDBDeviceSettings): IDBDevice {
  return {
    id: 'db-device-classic',
    connectId: 'CLASSIC_CONNECT_ID',
    deviceId: 'CLASSIC_DEVICE_ID',
    deviceType: EDeviceType.Classic,
    vendor: EHardwareVendor.onekey,
    name: 'OneKey Classic',
    features: '{}',
    settingsRaw: '{}',
    settings,
    createdAt: 0,
    updatedAt: 0,
  } as IDBDevice;
}

async function switchTo(
  inputPinOnSoftware: boolean,
  settings: IDBDeviceSettings,
) {
  jest
    .mocked(localDb.getDeviceByQuery)
    .mockResolvedValue(buildDevice(settings));
  jest.mocked(localDb.updateDeviceDbSettings).mockResolvedValue(undefined);
  const manager = new DeviceSettingsManager({
    backgroundApi: {} as IBackgroundApi,
  });
  await manager.setInputPinOnSoftwareByConnectId({
    connectId: 'CLASSIC_CONNECT_ID',
    inputPinOnSoftware,
  });
  return jest.mocked(localDb.updateDeviceDbSettings).mock.calls[0][0].settings;
}

describe('DeviceSettingsManager.setInputPinOnSoftwareByConnectId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stamps the explicit-choice marker when app entry is turned on', async () => {
    // Without the marker, the startup migration cannot tell this choice
    // from the creation-time default and flips it back to device entry.
    const settings = await switchTo(true, { inputPinOnSoftware: false });
    expect(settings).toEqual({
      inputPinOnSoftware: true,
      inputPinOnSoftwareSupport: true,
    });
  });

  it('leaves the marker as it was when app entry is turned off', async () => {
    const settings = await switchTo(false, {
      inputPinOnSoftware: true,
      inputPinOnSoftwareSupport: true,
    });
    expect(settings).toEqual({
      inputPinOnSoftware: false,
      inputPinOnSoftwareSupport: true,
    });
  });

  it('does not invent a marker when turning off an unmarked record', async () => {
    const settings = await switchTo(false, { inputPinOnSoftware: true });
    expect(settings).toEqual({
      inputPinOnSoftware: false,
      inputPinOnSoftwareSupport: undefined,
    });
  });
});
