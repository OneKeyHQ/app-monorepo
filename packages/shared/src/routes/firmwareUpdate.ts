import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

export enum EModalFirmwareUpdateRoutes {
  ChangeLog = 'ChangeLog',
  Install = 'Install',
}

export type IModalFirmwareUpdateParamList = {
  [EModalFirmwareUpdateRoutes.ChangeLog]: {
    connectId: string | undefined;
  };
  [EModalFirmwareUpdateRoutes.Install]: {
    result: ICheckAllFirmwareReleaseResult;
  };
};
