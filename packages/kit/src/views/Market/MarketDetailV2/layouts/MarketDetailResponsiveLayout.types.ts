export interface IMarketDetailResponsiveLayoutProps {
  isDesktopLayout: boolean;
  isChartFullscreen: boolean;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
  showFavoriteButton?: boolean;
  disableTrade?: boolean;
}
