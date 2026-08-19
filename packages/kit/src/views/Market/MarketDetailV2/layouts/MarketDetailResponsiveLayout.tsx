import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  isDesktopLayout,
  isChartFullscreen,
  isTradingViewNative,
  onChartSwitch,
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
        isTradingViewNative={isTradingViewNative}
        onChartSwitch={onChartSwitch}
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
      isTradingViewNative={isTradingViewNative}
      onChartSwitch={onChartSwitch}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
    />
  );
}
