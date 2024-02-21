import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ISwapSlippageItem {
  data: ISwapSlippageSegmentItem;
}

export class SimpleDbEntitySwapSlippage extends SimpleDbEntityBase<ISwapSlippageItem> {
  entityName = 'swapSlippage';

  override enableCache = true;
}
