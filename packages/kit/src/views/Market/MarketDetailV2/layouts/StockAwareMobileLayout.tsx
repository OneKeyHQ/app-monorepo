import type { ComponentProps } from 'react';

import { useStockDetail } from '../hooks/StockDetailContext';

import { MobileLayout as LegacyMobileLayout } from './legacyMobileLayout';
import { MobileLayout as MobileAssetLayout } from './MobileAssetLayout';

export function MobileLayout(props: ComponentProps<typeof MobileAssetLayout>) {
  const { isStockRoute } = useStockDetail();
  return isStockRoute ? (
    <MobileAssetLayout {...props} />
  ) : (
    <LegacyMobileLayout {...props} />
  );
}
