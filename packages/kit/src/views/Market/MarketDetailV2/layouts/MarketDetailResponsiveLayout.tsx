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
  marketTokenId,
  marketAssetDetail,
  isMarketAssetDetailLoading,
  marketTokenCategory,
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
        marketTokenId={marketTokenId}
        marketAssetDetail={marketAssetDetail}
        isMarketAssetDetailLoading={isMarketAssetDetailLoading}
        marketTokenCategory={marketTokenCategory}
        disableTrade={disableTrade}
        showFavoriteButton={showFavoriteButton}
      />
    );
  }

  return (
    <MobileLayout
      disableTrade={disableTrade}
      isChartFullscreen={isChartFullscreen}
      isTradingViewNative={isTradingViewNative}
      onChartFullscreenChange={onChartFullscreenChange}
      onChartSwitch={onChartSwitch}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
      marketTokenId={marketTokenId}
      marketTokenCategory={marketTokenCategory}
    />
  );
}
