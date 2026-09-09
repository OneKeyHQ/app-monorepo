import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

export interface IMarketDetailResponsiveLayoutProps {
  isDesktopLayout: boolean;
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
