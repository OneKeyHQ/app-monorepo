export enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  BorrowHome = 'BorrowHome',
  EarnPositions = 'EarnPositions',
  EarnTokens = 'EarnTokens',
  EarnFixedRateTokens = 'EarnFixedRateTokens',
  EarnAllProtocols = 'EarnAllProtocols',
  EarnProtocolTokens = 'EarnProtocolTokens',
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
  [ETabEarnRoutes.BorrowHome]: undefined;
  [ETabEarnRoutes.EarnPositions]: undefined;
  // Tokens 首页 (OK-58505)：全量代币列表 (页面内自带 All/Stable/Non-Stable 分类)
  [ETabEarnRoutes.EarnTokens]: undefined;
  // 固定收益独立列表 (OK-58879)
  [ETabEarnRoutes.EarnFixedRateTokens]: undefined;
  // Protocols 首页 (OK-58505)：全协议聚合列表
  [ETabEarnRoutes.EarnAllProtocols]: undefined;
  // 某个 Protocol 的 Tokens 列表 (OK-58505)
  [ETabEarnRoutes.EarnProtocolTokens]: {
    provider: string;
    providerName?: string;
    logoURI?: string;
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
