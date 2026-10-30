import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewNativeStorageNamespace } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import type { IMarketWidgetKind } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import type {
  EMarketBannerType,
  IMarketStockDetailPreview,
} from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeAnyIndicatorId } from '@onekeyhq/shared/types/tradingViewNative';

export enum EModalMarketRoutes {
  MarketDetailV2 = 'MarketDetailV2',
  MarketBannerDetail = 'MarketBannerDetail',
  MobileTokenSelector = 'MobileTokenSelector',
  MarketChartSettings = 'MarketChartSettings',
  MarketIndicatorSettings = 'MarketIndicatorSettings',
  MarketWidgetList = 'MarketWidgetList',
  MarketWidgetEditor = 'MarketWidgetEditor',
}

export type IModalMarketParamList = {
  [EModalMarketRoutes.MarketWidgetList]:
    | { kind?: IMarketWidgetKind }
    | undefined;
  [EModalMarketRoutes.MarketWidgetEditor]: {
    profileId?: string;
    kind?: IMarketWidgetKind;
  };
  [EModalMarketRoutes.MarketDetailV2]: {
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
  [EModalMarketRoutes.MarketBannerDetail]: {
    tokenListId: string;
    title: string;
    type?: EMarketBannerType;
  };
  [EModalMarketRoutes.MobileTokenSelector]:
    | {
        showFavoriteButton?: boolean;
        defaultCategory?: 'trending' | 'top_coins' | 'stocks';
      }
    | undefined;
  [EModalMarketRoutes.MarketChartSettings]:
    | {
        // Only stock detail charts can offer Prev close.
        showPreviousClose?: boolean;
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
  [EModalMarketRoutes.MarketIndicatorSettings]: {
    storageNamespace: ITradingViewNativeStorageNamespace;
    indicatorId?: ITradingViewNativeAnyIndicatorId;
  };
};
