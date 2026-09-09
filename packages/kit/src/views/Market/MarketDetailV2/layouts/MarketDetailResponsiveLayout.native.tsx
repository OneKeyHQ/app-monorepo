import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
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
  marketTokenCategory,
}: IMarketDetailResponsiveLayoutProps) {
  return (
    <MobileLayout
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
      marketTokenCategory={marketTokenCategory}
    />
  );
}
