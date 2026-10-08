import type { IMarketPreferredToken } from '../../types/market';
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
  marketTokenSymbol?: string;
  resolveMarketAsset?: boolean;
  skipMarketDataFetch?: boolean;
  legacyTokenPreview?: IMarketTokenDetailPreview;
  marketTokenPreviewId?: string;
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
    /**
     * The wallet asset the caller launched Market from. Lets the trade
     * actions resolve the network and contract address even when market
     * data has not mapped that platform; entries that only know the
     * CoinGecko id omit it. The legacy route forwards this identity to
     * the V2 detail page.
     */
    preferredToken?: IMarketPreferredToken;
  };
  [ETabMarketRoutes.MarketDetailV2]: IMarketTokenDetailRouteParams;
  [ETabMarketRoutes.MarketStockDetail]: IMarketStockDetailRouteParams;
  [ETabMarketRoutes.MarketNativeDetail]: {
    network: string;
    marketTokenId?: string;
    marketVariantId?: string;
    marketTokenCategory?: string;
    marketTokenSymbol?: string;
    resolveMarketAsset?: boolean;
    skipMarketDataFetch?: boolean;
    legacyTokenPreview?: IMarketTokenDetailPreview;
    marketTokenPreviewId?: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
    showFavoriteButton?: boolean;
  };
  [ETabMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
    assetType?: string;
  };
};
