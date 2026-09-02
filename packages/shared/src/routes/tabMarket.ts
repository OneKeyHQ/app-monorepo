import type {
  EMarketBannerType,
  IMarketTokenDetailPreview,
} from '../../types/marketV2';
import type { EEnterWay } from '../logger/scopes/dex';

export enum ETabMarketRoutes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
  MarketDetailV2 = 'MarketDetailV2',
  MarketStockDetail = 'MarketStockDetail',
  MarketNativeDetail = 'MarketNativeDetail',
  MarketBannerDetail = 'MarketBannerDetail',
}

export type IMarketTokenDetailRouteParams = {
  tokenAddress: string;
  network: string;
  marketTokenId?: string;
  marketVariantId?: string;
  marketTokenCategory?: string;
  skipMarketDataFetch?: boolean;
  legacyTokenPreview?: IMarketTokenDetailPreview;
  stockId?: never;
  isNative?: boolean;
  from?: EEnterWay;
  disableTrade?: boolean;
  showFavoriteButton?: boolean;
};

export type IMarketStockDetailRouteParams = {
  stockId: string;
  stockPreviewSymbol?: string;
  stockPreviewName?: string;
  stockPreviewLogoUrl?: string;
  tokenAddress?: string;
  network?: string;
  isNative?: boolean;
  from?: EEnterWay;
  disableTrade?: boolean;
  showFavoriteButton?: boolean;
};

export type ITabMarketParamList = {
  [ETabMarketRoutes.TabMarket]: { from?: EEnterWay } | undefined;
  [ETabMarketRoutes.MarketDetail]: {
    token: string;
  };
  [ETabMarketRoutes.MarketDetailV2]: IMarketTokenDetailRouteParams;
  [ETabMarketRoutes.MarketStockDetail]: IMarketStockDetailRouteParams;
  [ETabMarketRoutes.MarketNativeDetail]: {
    network: string;
    marketTokenId?: string;
    marketVariantId?: string;
    marketTokenCategory?: string;
    skipMarketDataFetch?: boolean;
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
