export enum ETabMarketRoutes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
  MarketDetailV2 = 'MarketDetailV2',
}

export type ITabMarketParamList = {
  [ETabMarketRoutes.TabMarket]: undefined;
  [ETabMarketRoutes.MarketDetail]: {
    token: string;
  };
  [ETabMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    networkId: string;
    symbol?: string;
  };
};
