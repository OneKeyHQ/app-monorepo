import type { IDeviceType } from '@onekeyfe/hd-core';

export enum EModalLegacyFirmwareUpdateRoutes {
  LegacyUpdate = 'LegacyUpdate',
}

export type IModalLegacyFirmwareUpdateParamList = {
  [EModalLegacyFirmwareUpdateRoutes.LegacyUpdate]: {
    connectId: string | undefined;
    deviceType: IDeviceType | string;
    currentFirmwareVersion: string;
    currentBootloaderVersion: string;
    targetFirmwareVersion?: string;
    isBootloaderMode?: boolean;
  };
};
