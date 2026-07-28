import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  disableTrade,
  networkId,
  tokenAddress,
}: IMarketDetailResponsiveLayoutProps) {
  return (
    <MobileLayout
      disableTrade={disableTrade}
      networkId={networkId}
      tokenAddress={tokenAddress}
    />
  );
}
