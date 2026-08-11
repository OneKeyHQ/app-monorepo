import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  disableTrade,
  isNative,
  networkId,
  tokenAddress,
}: IMarketDetailResponsiveLayoutProps) {
  return (
    <MobileLayout
      disableTrade={disableTrade}
      isNative={isNative}
      networkId={networkId}
      tokenAddress={tokenAddress}
    />
  );
}
