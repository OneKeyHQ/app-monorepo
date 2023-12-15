import type { ISwapNetwork } from '@onekeyhq/kit/src/views/Swap/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ISwapNetworks {
  data: ISwapNetwork[];
}

export class SimpleDbEntitySwapNetworksSort extends SimpleDbEntityBase<ISwapNetworks> {
  entityName = 'swapNetworksSort';

  override enableCache = true;
}
