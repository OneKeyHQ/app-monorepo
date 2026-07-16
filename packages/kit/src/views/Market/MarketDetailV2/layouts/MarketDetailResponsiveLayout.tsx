import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  isDesktopLayout,
  isChartFullscreen,
  onChartFullscreenChange,
  networkId,
  tokenAddress,
  showFavoriteButton,
  disableTrade,
}: IMarketDetailResponsiveLayoutProps) {
  if (isDesktopLayout) {
    return (
      <DesktopLayout
        isChartFullscreen={isChartFullscreen}
        onChartFullscreenChange={onChartFullscreenChange}
        networkId={networkId}
        tokenAddress={tokenAddress}
        showFavoriteButton={showFavoriteButton}
      />
    );
  }

  return <MobileLayout disableTrade={disableTrade} />;
}
