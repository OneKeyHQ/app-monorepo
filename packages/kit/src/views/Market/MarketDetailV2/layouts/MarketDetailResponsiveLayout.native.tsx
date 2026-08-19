import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  disableTrade,
  isTradingViewNative,
  onChartSwitch,
  isNative,
  networkId,
  tokenAddress,
}: IMarketDetailResponsiveLayoutProps) {
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
