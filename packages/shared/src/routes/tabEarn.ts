export enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  EarnProtocols = 'EarnProtocols',
  EarnProtocolDetails = 'EarnProtocolDetails',
  EarnProtocolDetailsShare = 'EarnProtocolDetailsShare',
}

export type ITabEarnParamList = {
  [ETabEarnRoutes.EarnHome]:
    | undefined
    | {
        tab?: 'assets' | 'portfolio' | 'faqs';
      };
  [ETabEarnRoutes.EarnProtocols]: {
    symbol: string;
    filterNetworkId?: string;
    logoURI?: string;
  };
  [ETabEarnRoutes.EarnProtocolDetails]: {
    networkId: string;
    symbol: string;
    provider: string;
    vault?: string;
  };
  [ETabEarnRoutes.EarnProtocolDetailsShare]: {
    network: string; // network name, like 'ethereum', 'bitcoin'
    symbol: string;
    provider: string;
    vault?: string;
  };
};
