export enum EModalFirmwareUpdateRoutes {
  ChangeLog = 'ChangeLog',
}

export type IModalFirmwareUpdateParamList = {
  [EModalFirmwareUpdateRoutes.ChangeLog]: {
    connectId: string | undefined;
  };
};
