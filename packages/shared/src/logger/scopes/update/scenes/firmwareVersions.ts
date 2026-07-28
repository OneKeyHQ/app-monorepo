import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

type IFirmwareType = 'Firmware' | 'Bootloader' | 'Bluetooth';

interface IFirmwareVersionInfo {
  type: IFirmwareType;
  fromVersion: string;
  toVersion: string;
  hasUpgrade: boolean;
}

export interface IFirmwareVersions {
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
