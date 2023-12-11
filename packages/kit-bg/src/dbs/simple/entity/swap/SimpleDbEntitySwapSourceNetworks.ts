import { SimpleDbEntityBase } from '../SimpleDbEntityBase';

import type { ISwapNetwork } from '../../../../services/ServiceSwap';

export interface ISwapSourceNetworks {
  data: ISwapNetwork[];
}

export class SimpleDbEntitySwapSourceNetworks extends SimpleDbEntityBase<ISwapSourceNetworks> {
  entityName = 'swapSourceNetworks';

  override enableCache = true;
}
