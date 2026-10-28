export enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  BorrowHome = 'BorrowHome',
  EarnPositions = 'EarnPositions',
  EarnTokens = 'EarnTokens',
  EarnFixedRateTokens = 'EarnFixedRateTokens',
  EarnAllProtocols = 'EarnAllProtocols',
  EarnHoldings = 'EarnHoldings',
  EarnLoans = 'EarnLoans',
  EarnProtocolTokens = 'EarnProtocolTokens',
  EarnProtocols = 'EarnProtocols',
  EarnProtocolDetails = 'EarnProtocolDetails',
  EarnProtocolDetailsShare = 'EarnProtocolDetailsShare',
  EarnLendingDetails = 'EarnLendingDetails',
  BorrowReserveDetails = 'BorrowReserveDetails',
  BorrowReserveDetailsShare = 'BorrowReserveDetailsShare',
}

export type ITabEarnParamList = {
  [ETabEarnRoutes.EarnHome]:
    | undefined
    | {
        tab?: 'assets' | 'portfolio' | 'faqs';
        mode?: 'earn' | 'borrow';
        // A token's breadcrumb on its pages (demo 10-27): its row on the
        // desktop home opens; openAt tells one request from the next
        openSymbol?: string;
        openAt?: number;
      };
  [ETabEarnRoutes.BorrowHome]:
    | undefined
    | {
        // The market to open; the desktop home's market cards pass all three
        provider?: string;
        networkId?: string;
        marketAddress?: string;
      };
  [ETabEarnRoutes.EarnPositions]: undefined;
  // Tokens home (OK-58505): full token list (with in-page All/Stable/Non-Stable categories)
  [ETabEarnRoutes.EarnTokens]: undefined;
  // Standalone fixed-rate list (OK-58879)
  [ETabEarnRoutes.EarnFixedRateTokens]: undefined;
  // Protocols home (OK-58505): aggregated list of all protocols
  [ETabEarnRoutes.EarnAllProtocols]: undefined;
  // The phone home's full lists (demo 10-28): every row of Earns on your
  // holding, and the Loans pairs
  [ETabEarnRoutes.EarnHoldings]: undefined;
  [ETabEarnRoutes.EarnLoans]: undefined;
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
    // OK-61377: the phone positions page's Manage lands on the position, so
    // the page scrolls its Portfolio tab into view once it has loaded.
    scrollToPortfolio?: boolean;
  };
  [ETabEarnRoutes.EarnProtocolDetailsShare]: {
    network: string; // network name, like 'ethereum', 'bitcoin'
    symbol: string;
    provider: string;
    vault?: string;
  };
  // A lending market's supply side (Aave, Kamino) as an Earn details page,
  // opened from the desktop Earn table (demo 10-27)
  [ETabEarnRoutes.EarnLendingDetails]: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    symbol: string;
    logoURI?: string;
    accountId?: string;
    indexedAccountId?: string;
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
