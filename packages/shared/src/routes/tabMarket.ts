export enum ETabMarketRoutes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
  MarketRealTimeTradingView = 'MarketRealTimeTradingView',
}

export type ITabMarketParamList = {
  [ETabMarketRoutes.TabMarket]: undefined;
  [ETabMarketRoutes.MarketDetail]: {
    token: string;
  };
  [ETabMarketRoutes.MarketRealTimeTradingView]: {
    symbol: string;
  };
};
