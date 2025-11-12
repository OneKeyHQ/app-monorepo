export enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  EarnProtocols = 'EarnProtocols',
  EarnProtocolDetails = 'EarnProtocolDetails',
}

export type ITabEarnParamList = {
  [ETabEarnRoutes.EarnHome]: undefined;
  [ETabEarnRoutes.EarnProtocols]: {
    symbol: string;
    filterNetworkId?: string;
    logoURI?: string;
  };
  [ETabEarnRoutes.EarnProtocolDetails]: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    provider: string;
    vault?: string;
  };
};
