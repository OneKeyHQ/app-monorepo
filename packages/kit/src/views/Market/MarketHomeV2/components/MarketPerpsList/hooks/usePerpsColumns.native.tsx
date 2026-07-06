import type { ITableColumn } from '@onekeyhq/components';

import { usePerpsColumnsMobile } from './usePerpsColumnsMobile';

import type { IMarketPerpsToken } from './useMarketPerpsTokenList';

export function usePerpsColumns(): ITableColumn<IMarketPerpsToken>[] {
  // Native only renders the mobile perps table; keep desktop-only star imports out of Metro.
  return usePerpsColumnsMobile();
}

export { usePerpsColumnsMobile };
