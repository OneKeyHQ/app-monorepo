import type {
  EMarketBannerType,
  IMarketHighlight,
  IMarketStockDetailPreview,
} from '../../types/marketV2';
import type { ITradingViewNativeAnyIndicatorId } from '../../types/tradingViewNative';
import type { IMarketWidgetKind } from '../modules/MarketWidget/types';

export type ITradingViewChartMode = 'native' | 'tradingView';
export type ITradingViewNativeStorageNamespace = 'market' | 'perps' | 'swap';

export type IMarketHighlightQuote = {
  updatedAt?: number;
  logoUrl?: string;
  isUSStock?: boolean;
  maxLeverage?: number;
  price?: string;
  priceChange24hPercent?: string | number;
};

export type IMarketHighlightsPreview = {
  locale: string;
  items: IMarketHighlight[];
};

// Keep keys as string literals so this module stays 100% type-only and adds
// zero runtime imports or Metro module-id-registry entries.
export type IModalMarketParamList = {
  MarketWidgetList:
    | { kind?: IMarketWidgetKind; needsBinding?: boolean }
    | undefined;
  MarketWidgetEditor: {
    profileId?: string;
    kind?: IMarketWidgetKind;
    editorSession?: string;
  };
  MarketDetailV2: {
    tokenAddress?: string;
    network?: string;
    stockId?: string;
    stockPreviewSymbol?: string;
    stockPreviewName?: string;
    stockPreviewLogoUrl?: string;
    stockPreviewQuote?: IMarketStockDetailPreview['quote'];
    isNative?: boolean;
    showFavoriteButton?: boolean;
  };
  MarketBannerDetail: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
  };
  MarketHighlights:
    | {
        initialHighlightId?: string;
        initialQuotes?: [string, IMarketHighlightQuote][];
        initialHighlights?: IMarketHighlightsPreview;
      }
    | undefined;
  MobileTokenSelector:
    | {
        showFavoriteButton?: boolean;
        defaultCategory?: 'trending' | 'top_coins' | 'stocks';
      }
    | undefined;
  MarketChartSettings:
    | {
        // Only stock detail charts can offer Prev close.
        showPreviousClose?: boolean;
        showNavigationButtons?: boolean;
        storageNamespace?: ITradingViewNativeStorageNamespace;
        // Native toolbars hide the chart type select, so their settings must
        // offer chart style at every width.
        showChartType?: boolean;
        // Charts that can switch source expose the switch on this page.
        chartMode?: ITradingViewChartMode;
        isChartSwitchDisabled?: boolean;
        onChartSwitch?: () => void;
      }
    | undefined;
  MarketIndicatorSettings: {
    storageNamespace: ITradingViewNativeStorageNamespace;
    indicatorId?: ITradingViewNativeAnyIndicatorId;
  };
};
