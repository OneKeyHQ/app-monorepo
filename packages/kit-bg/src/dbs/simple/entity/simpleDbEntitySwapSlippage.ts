import type { ISwapSlippageSegmentItem } from '@onekeyhq/kit/src/views/Swap/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ISwapSlippageItem {
  data: ISwapSlippageSegmentItem;
}

export class SimpleDbEntitySwapSlippage extends SimpleDbEntityBase<ISwapSlippageItem> {
  entityName = 'swapSlippage';

  override enableCache = true;
}
