import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDexSwapParams } from '../types';

export class SwapScene extends BaseScene {
  /**
   * Track token buy/sell transactions
   * Logs when user submits purchase
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexSwap(params: IDexSwapParams) {
    return params;
  }
}
