import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

export interface IMarketDetailResponsiveLayoutProps {
  // False while a Desktop/Web route is retained but no longer owns the shared
  // detail state. Polls have to stop there: focus checks cannot express this, so
  // ownership is passed down the same way `useAutoRefreshTokenDetail` takes it.
  active?: boolean;
  isDesktopLayout: boolean;
  isLayoutPending?: boolean;
  isInitialContentPending?: boolean;
  isTokenDetailRequestPending?: boolean;
  disablePerpsBanner?: boolean;
  isChartFullscreen: boolean;
  isTradingViewNative: boolean;
  onChartSwitch: () => void;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
  isNative: boolean;
  networkId: string;
  tokenAddress: string;
  marketTokenId?: string;
  marketAssetDetail?: IMarketAssetDetailData;
  isMarketAssetDetailLoading?: boolean;
  marketTokenCategory?: string;
  showFavoriteButton?: boolean;
  disableTrade?: boolean;
}
