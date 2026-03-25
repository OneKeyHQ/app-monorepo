export enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  EarnProtocols = 'EarnProtocols',
  EarnProtocolDetails = 'EarnProtocolDetails',
  EarnProtocolDetailsShare = 'EarnProtocolDetailsShare',
  BorrowReserveDetails = 'BorrowReserveDetails',
  BorrowReserveDetailsShare = 'BorrowReserveDetailsShare',
}

export type ITabEarnParamList = {
  [ETabEarnRoutes.EarnHome]:
    | undefined
    | {
        tab?: 'assets' | 'portfolio' | 'faqs';
        mode?: 'earn' | 'borrow';
      };
  [ETabEarnRoutes.EarnProtocols]: {
    symbol: string;
    filterNetworkId?: string;
    logoURI?: string;
    defaultCategory?: 'simpleEarn' | 'fixedRate';
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
  [ETabEarnRoutes.BorrowReserveDetails]: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    symbol: string;
    logoURI?: string;
    accountId?: string;
    indexedAccountId?: string;
  };
  [ETabEarnRoutes.BorrowReserveDetailsShare]: {
    networkId: string;
    symbol: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    logoURI?: string;
    accountId?: string;
    indexedAccountId?: string;
  };
};
