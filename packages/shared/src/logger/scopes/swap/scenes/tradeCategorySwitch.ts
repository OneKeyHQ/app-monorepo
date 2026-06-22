import type {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class TradeCategorySwitchScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public tradeCategorySwitch({
    fromCategory,
    toCategory,
    enterFrom,
  }: {
    fromCategory: ESwapTabSwitchType;
    toCategory: ESwapTabSwitchType;
    enterFrom?: ESwapSource;
  }) {
    return {
      fromCategory,
      toCategory,
      enterFrom,
    };
  }
}
