import type { EEnterWay } from '../logger/scopes/dex';

export enum ETabMarketRoutes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
  MarketDetailV2 = 'MarketDetailV2',
  MarketNativeDetail = 'MarketNativeDetail',
  MarketBannerDetail = 'MarketBannerDetail',
}

export type ITabMarketParamList = {
  [ETabMarketRoutes.TabMarket]: { from?: EEnterWay } | undefined;
  [ETabMarketRoutes.MarketDetail]: {
    token: string;
  };
  [ETabMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
  };
  [ETabMarketRoutes.MarketNativeDetail]: {
    network: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
  };
  [ETabMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
  };
};
