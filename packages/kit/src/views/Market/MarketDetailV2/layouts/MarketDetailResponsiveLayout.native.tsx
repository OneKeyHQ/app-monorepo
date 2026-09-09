import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
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
