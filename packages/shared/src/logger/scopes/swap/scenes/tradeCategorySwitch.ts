import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class TradeCategorySwitchScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public tradeCategorySwitch({
    fromTradeCategory,
    toTradeCategory,
  }: {
    fromTradeCategory: ESwapTabSwitchType;
    toTradeCategory: ESwapTabSwitchType;
  }) {
    return {
      fromTradeCategory,
      toTradeCategory,
    };
  }
}
