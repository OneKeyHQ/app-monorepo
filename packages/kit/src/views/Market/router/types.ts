import type { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
  MarketBannerDetail = 'MarketBannerDetail',
  MobileTokenSelector = 'MobileTokenSelector',
  MarketChartSettings = 'MarketChartSettings',
  MarketIndicatorSettings = 'MarketIndicatorSettings',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketDetailV2]: {
    tokenAddress?: string;
    network?: string;
    stockId?: string;
    stockPreviewSymbol?: string;
    stockPreviewName?: string;
    stockPreviewLogoUrl?: string;
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
  [EModalMarketRoutes.MarketChartSettings]:
    | {
        // Only stock detail charts can offer Prev close.
        showPreviousClose?: boolean;
      }
    | undefined;
  [EModalMarketRoutes.MarketIndicatorSettings]: {
    storageNamespace: 'market' | 'swap';
  };
};
