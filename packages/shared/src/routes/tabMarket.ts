import type { IMarketPreferredToken } from '../../types/market';
import type { EMarketBannerType } from '../../types/marketV2';
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
    /**
     * The wallet asset the caller launched Market from. Lets the trade
     * actions resolve the network and contract address even when market
     * data has not mapped that platform; entries that only know the
     * CoinGecko id omit it. Deliberately not keyed `networkId`: the
     * MarketDetail dispatcher treats that key as "render V2".
     */
    preferredToken?: IMarketPreferredToken;
  };
  [ETabMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
    showFavoriteButton?: boolean;
  };
  [ETabMarketRoutes.MarketNativeDetail]: {
    network: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
    showFavoriteButton?: boolean;
  };
  [ETabMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
  };
};
