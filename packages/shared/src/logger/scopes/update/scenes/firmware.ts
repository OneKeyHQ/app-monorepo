import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

type IFirmwareType = 'Firmware' | 'Bootloader' | 'Bluetooth';

interface IFirmwareVersionInfo {
  type: IFirmwareType;
  fromVersion: string;
  toVersion: string;
  hasUpgrade: boolean;
}

interface IFirmwareVersions {
  firmware?: IFirmwareVersionInfo;
  bootloader?: IFirmwareVersionInfo;
  ble?: IFirmwareVersionInfo;
}

export function parseFirmwareVersions(
  result: ICheckAllFirmwareReleaseResult,
): IFirmwareVersions {
  return {
    ...(result.updateInfos?.firmware?.hasUpgrade && {
      firmware: {
        type: 'Firmware',
        fromVersion: result.updateInfos.firmware.fromVersion ?? '',
        toVersion: result.updateInfos.firmware.toVersion ?? '',
        hasUpgrade: true,
      },
    }),
    ...(result.updateInfos?.bootloader?.hasUpgrade && {
      bootloader: {
        type: 'Bootloader',
        fromVersion: result.updateInfos.bootloader.fromVersion ?? '',
        toVersion: result.updateInfos.bootloader.toVersion ?? '',
        hasUpgrade: true,
      },
    }),
    ...(result.updateInfos?.ble?.hasUpgrade && {
      ble: {
        type: 'Bluetooth',
        fromVersion: result.updateInfos.ble.fromVersion ?? '',
        toVersion: result.updateInfos.ble.toVersion ?? '',
        hasUpgrade: true,
      },
    }),
  };
}

export class FirmwareScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public firmwareUpdateStarted(params: {
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v1' | 'v2';
    firmwareVersions: IFirmwareVersions;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareUpdateResult(params: {
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v1' | 'v2';
    firmwareVersions: IFirmwareVersions;
    status: 'success' | 'failed';
    errorCode?: string;
    errorMessage?: string;
  }) {
    return params;
  }
}
