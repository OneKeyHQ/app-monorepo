import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ISwapNetworks {
  data: ISwapNetwork[];
}

export class SimpleDbEntitySwapNetworksSort extends SimpleDbEntityBase<ISwapNetworks> {
  entityName = 'swapNetworksSort';

  override enableCache = true;
}
