import type { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ISwapConfigs {
  providerSort: ESwapProviderSort;
}

export class SimpleDbEntitySwapConfigs extends SimpleDbEntityBase<ISwapConfigs> {
  entityName = 'swapConfigs';
}
