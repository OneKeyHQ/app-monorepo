import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

export enum EModalFirmwareUpdateRoutes {
  ChangeLog = 'ChangeLog',
  Install = 'Install',
  InstallV2 = 'InstallV2', // for new bootloader version
}

export type IModalFirmwareUpdateParamList = {
  [EModalFirmwareUpdateRoutes.ChangeLog]: {
    connectId: string | undefined;
  };
  [EModalFirmwareUpdateRoutes.Install]: {
    result: ICheckAllFirmwareReleaseResult;
  };
  [EModalFirmwareUpdateRoutes.InstallV2]: {
    result: ICheckAllFirmwareReleaseResult;
  };
};
