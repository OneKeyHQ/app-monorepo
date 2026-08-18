import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  isDesktopLayout,
  isChartFullscreen,
  onChartFullscreenChange,
  isNative,
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
        isNative={isNative}
        networkId={networkId}
        tokenAddress={tokenAddress}
        showFavoriteButton={showFavoriteButton}
      />
    );
  }

  return (
    <MobileLayout
      disableTrade={disableTrade}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
    />
  );
}
