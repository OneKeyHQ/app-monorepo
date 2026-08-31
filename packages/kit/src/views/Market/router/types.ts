import type { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
  MarketBannerDetail = 'MarketBannerDetail',
  MobileTokenSelector = 'MobileTokenSelector',
  MarketChartSettings = 'MarketChartSettings',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketDetailV2]: {
    tokenAddress?: string;
    network?: string;
    stockId?: string;
    isNative?: boolean;
    chartMode?: 'native' | 'tradingView';
    showFavoriteButton?: boolean;
  };
  [EModalMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
  };
  [EModalMarketRoutes.MobileTokenSelector]:
    | {
        chartMode?: 'native' | 'tradingView';
        showFavoriteButton?: boolean;
      }
    | undefined;
  [EModalMarketRoutes.MarketChartSettings]: undefined;
};
