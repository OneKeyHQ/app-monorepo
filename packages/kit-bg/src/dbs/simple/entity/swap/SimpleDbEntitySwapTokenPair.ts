import { SimpleDbEntityBase } from '../SimpleDbEntityBase';

import type { ISwapToken } from '../../../../services/ServiceSwap';

export interface ISwapTokenPair {
  fromToken: ISwapToken;
  toToken: ISwapToken;
}

export class SimpleDbEntitySwapTokenPair extends SimpleDbEntityBase<ISwapTokenPair> {
  entityName = 'swapTokenPair';

  override enableCache = true;
}
