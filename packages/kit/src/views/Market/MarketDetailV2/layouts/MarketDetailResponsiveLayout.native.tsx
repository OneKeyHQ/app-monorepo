import { MobileLayout } from './MobileLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

export function MarketDetailResponsiveLayout({
  disableTrade,
}: IMarketDetailResponsiveLayoutProps) {
  return <MobileLayout disableTrade={disableTrade} />;
}
