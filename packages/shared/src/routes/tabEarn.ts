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
  // Tokens home (OK-58505): full token list (with in-page All/Stable/Non-Stable categories)
  [ETabEarnRoutes.EarnTokens]: undefined;
  // Standalone fixed-rate list (OK-58879)
  [ETabEarnRoutes.EarnFixedRateTokens]: undefined;
  // Protocols home (OK-58505): aggregated list of all protocols
  [ETabEarnRoutes.EarnAllProtocols]: undefined;
  // Tokens list of a single protocol (OK-58505)
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
    // OK-59304: the token logo the entry list already had on screen. The page
    // otherwise has no logo until getProtocolDetailsV2 resolves and renders
    // the placeholder icon in the meantime.
    logoURI?: string;
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
