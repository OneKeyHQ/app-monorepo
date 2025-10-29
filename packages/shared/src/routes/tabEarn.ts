export enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  EarnProtocols = 'EarnProtocols',
}

export type ITabEarnParamList = {
  [ETabEarnRoutes.EarnHome]: undefined;
  [ETabEarnRoutes.EarnProtocols]: {
    symbol: string;
    filterNetworkId?: string;
    logoURI?: string;
  };
};
