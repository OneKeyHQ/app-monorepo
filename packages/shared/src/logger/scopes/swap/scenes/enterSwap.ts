import type { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class EnterSwapScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public enterSwap({ enterFrom }: { enterFrom: ESwapSource }) {
    return {
      enterFrom,
    };
  }
}
