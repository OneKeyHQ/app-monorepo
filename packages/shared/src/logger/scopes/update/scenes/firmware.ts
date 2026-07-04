import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IFirmwareVersions } from './firmwareVersions';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

export { parseFirmwareVersions } from './firmwareVersions';

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
  public firmwareSwitchStart(params: {
    deviceType: IDeviceType | undefined;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
  }) {
    return params;
  }

  @LogToServer()
  public firmwareSwitchSuccess(params: {
    deviceType: IDeviceType | undefined;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
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
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
    status: 'success' | 'failed';
    errorCode?: string;
    errorMessage?: string;
  }) {
    return params;
  }
}
