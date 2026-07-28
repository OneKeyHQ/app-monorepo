import type { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
  MarketBannerDetail = 'MarketBannerDetail',
  MobileTokenSelector = 'MobileTokenSelector',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
    showFavoriteButton?: boolean;
  };
  [EModalMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
  };
  [EModalMarketRoutes.MobileTokenSelector]:
    | {
        showFavoriteButton?: boolean;
      }
    | undefined;
};
