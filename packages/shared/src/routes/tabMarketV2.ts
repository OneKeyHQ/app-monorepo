export enum ETabMarketV2Routes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
}

export type ITabMarketV2ParamList = {
  [ETabMarketV2Routes.TabMarket]: undefined;
  [ETabMarketV2Routes.MarketDetail]: {
    tokenAddress: string;
    networkId: string;
  };
};
