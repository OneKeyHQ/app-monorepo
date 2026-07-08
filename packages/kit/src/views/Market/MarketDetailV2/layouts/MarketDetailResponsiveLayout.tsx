import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  isDesktopLayout,
  isChartFullscreen,
  onChartFullscreenChange,
  showFavoriteButton,
  disableTrade,
}: IMarketDetailResponsiveLayoutProps) {
  if (isDesktopLayout) {
    return (
      <DesktopLayout
        isChartFullscreen={isChartFullscreen}
        onChartFullscreenChange={onChartFullscreenChange}
        showFavoriteButton={showFavoriteButton}
      />
    );
  }

  return <MobileLayout disableTrade={disableTrade} />;
}
