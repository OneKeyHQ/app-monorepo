export enum GasPanelRoutes {
  GasPanelModal = 'GasPanelModal',
}

export type GasPanelRoutesParams = {
  [GasPanelRoutes.GasPanelModal]: {
    networkId?: string;
  };
};
