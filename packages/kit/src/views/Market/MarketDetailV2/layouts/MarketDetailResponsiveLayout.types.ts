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
  marketTokenCategory?: string;
  showFavoriteButton?: boolean;
  disableTrade?: boolean;
}
