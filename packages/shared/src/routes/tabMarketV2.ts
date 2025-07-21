export enum ETabMarketV2Routes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
  MarketSwap = 'MarketSwap',
}

export type ITabMarketV2ParamList = {
  [ETabMarketV2Routes.TabMarket]: undefined;
  [ETabMarketV2Routes.MarketDetail]: {
    tokenAddress: string;
    networkId: string;
  };
  [ETabMarketV2Routes.MarketSwap]: {
    tokenAddress: string;
    networkId: string;
  };
};
