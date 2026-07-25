import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type {
  ICheckAllFirmwareReleaseResult,
  IFirmwareUpdateInfo,
} from '@onekeyhq/shared/types/device';

import ServiceFirmwareUpdate from './ServiceFirmwareUpdate';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { CoreApi } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    ShowFirmwareUpdateFromBootloaderMode:
      'ShowFirmwareUpdateFromBootloaderMode',
  },
  appEventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    init: 'init',
    installing: 'installing',
  },
  EHardwareUiStateAction: {
    FIRMWARE_TIP: 'firmware-tip',
  },
  firmwareUpdateResultVerifyAtom: {
    set: jest.fn(),
  },
  firmwareUpdateRetryAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  firmwareUpdateStepInfoAtom: {
    set: jest.fn(),
  },
  firmwareUpdateWorkflowRunningAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  firmwareUpdatesDetectStatusPersistAtom: {
    set: jest.fn(),
  },
  hardwareUiStateAtom: {
    set: jest.fn(),
  },
}));

jest.mock('../ServiceHardware/serviceHardwareUtils', () => ({
  __esModule: true,
  default: {
    hardwareLog: jest.fn(),
  },
}));

describe('ServiceFirmwareUpdate Classic 1S SDK consumption', () => {
  it('uses the version overload and pairs firmware event listeners', async () => {
    const expectedResult = {
      message: 'firmware update accepted',
    };
    const firmwareUpdateV2 = jest.fn().mockResolvedValue({
      success: true,
      payload: expectedResult,
    });
    const on = jest.fn();
    const off = jest.fn();
    const hardwareSDK = {
      firmwareUpdateV2,
      off,
      on,
    } as unknown as CoreApi;
    const getSDKInstance = jest.fn().mockResolvedValue(hardwareSDK);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
        serviceHardware: {
          getSDKInstance,
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.BLE),
        },
      } as unknown as IBackgroundApi,
    });
    const updateInfo = {
      connectId: 'classic-1s-connect-id',
      hasUpgrade: true,
      hasUpgradeForce: false,
      firmwareType: 'firmware',
      fromVersion: '2.9.0',
      fromFirmwareType: EFirmwareType.Universal,
      toVersion: '3.0.0',
      toFirmwareType: EFirmwareType.Universal,
      changelog: undefined,
      releasePayload: {},
    } as IFirmwareUpdateInfo;
    const releaseResult = {
      totalPhase: ['firmware'],
    } as ICheckAllFirmwareReleaseResult;

    await expect(
      service.updatingFirmware(
        {
          connectId: 'classic-1s-connect-id',
          version: '3.0.0',
          firmwareType: 'firmware',
          deviceType: EDeviceType.Classic1s,
        },
        updateInfo,
        {
          backuped: true,
          usbConnected: true,
          releaseResult,
        },
      ),
    ).resolves.toEqual(expectedResult);

    expect(firmwareUpdateV2).toHaveBeenCalledTimes(1);
    const [, firmwareUpdateParams] = firmwareUpdateV2.mock.calls[0];
    expect(firmwareUpdateParams).toEqual(
      expect.objectContaining({
        firmwareType: EFirmwareType.Universal,
        forcedUpdateRes: false,
        updateType: 'firmware',
        version: [3, 0, 0],
      }),
    );
    expect(firmwareUpdateParams).not.toHaveProperty('binary');

    expect(on).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledWith(...on.mock.calls[0]);
  });
});
