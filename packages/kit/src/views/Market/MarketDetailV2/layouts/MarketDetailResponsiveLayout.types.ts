export interface IMarketDetailResponsiveLayoutProps {
  isDesktopLayout: boolean;
  isChartFullscreen: boolean;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
  networkId: string;
  tokenAddress: string;
  showFavoriteButton?: boolean;
  disableTrade?: boolean;
}
