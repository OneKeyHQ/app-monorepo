import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

export enum EModalFirmwareUpdateRoutes {
  ChangeLog = 'ChangeLog',
  Install = 'Install',
  InstallV2 = 'InstallV2', // for new bootloader version
}

export type IModalFirmwareUpdateParamList = {
  [EModalFirmwareUpdateRoutes.ChangeLog]: {
    connectId: string | undefined;
    firmwareType: EFirmwareType | undefined;
    baseReleaseInfo?: AllFirmwareRelease;
  };
  [EModalFirmwareUpdateRoutes.Install]: {
    result: ICheckAllFirmwareReleaseResult;
  };
  [EModalFirmwareUpdateRoutes.InstallV2]: {
    result: ICheckAllFirmwareReleaseResult;
  };
};
