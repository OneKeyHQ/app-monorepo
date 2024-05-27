export enum ETabMarketRoutes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
}

export type ITabMarketParamList = {
  [ETabMarketRoutes.TabMarket]: undefined;
  [ETabMarketRoutes.MarketDetail]: {
    coinGeckoId: string;
    icon?: string;
    symbol?: string;
  };
};
