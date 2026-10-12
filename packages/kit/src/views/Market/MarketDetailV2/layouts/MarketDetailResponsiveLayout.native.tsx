import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  active,
  isLayoutPending,
  isInitialContentPending,
  disablePerpsBanner,
  disableTrade,
  isChartFullscreen,
  isTradingViewNative,
  onChartFullscreenChange,
  onChartSwitch,
  isNative,
  networkId,
  tokenAddress,
  marketTokenId,
  marketAssetDetail,
  isMarketAssetDetailLoading,
  marketTokenCategory,
}: IMarketDetailResponsiveLayoutProps) {
  return (
    <MobileLayout
      active={active}
      isLayoutPending={isLayoutPending}
      isInitialContentPending={isInitialContentPending}
      disablePerpsBanner={disablePerpsBanner}
      disableTrade={disableTrade}
      isChartFullscreen={isChartFullscreen}
      isTradingViewNative={isTradingViewNative}
      onChartFullscreenChange={onChartFullscreenChange}
      onChartSwitch={onChartSwitch}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
      marketTokenId={marketTokenId}
      marketAssetDetail={marketAssetDetail}
      isMarketAssetDetailLoading={isMarketAssetDetailLoading}
      marketTokenCategory={marketTokenCategory}
    />
  );
}
