import type { ISwapToken } from '@onekeyhq/kit/src/views/Swap/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ISwapTokenPair {
  fromToken: ISwapToken;
  toToken: ISwapToken;
}

export class SimpleDbEntitySwapTokenPair extends SimpleDbEntityBase<ISwapTokenPair> {
  entityName = 'swapTokenPair';

  override enableCache = true;
}
