export enum ETabMarketV2Routes {
  TabMarket = 'TabMarketV2',
  MarketDetail = 'MarketDetailV2',
  MarketSwap = 'MarketSwapV2',
}

export type ITabMarketV2ParamList = {
  [ETabMarketV2Routes.TabMarket]: undefined;
  [ETabMarketV2Routes.MarketDetail]: {
    symbol?: string;
    tokenAddress: string;
    networkId: string;
  };
  [ETabMarketV2Routes.MarketSwap]: {
    tokenAddress: string;
    networkId: string;
  };
};
