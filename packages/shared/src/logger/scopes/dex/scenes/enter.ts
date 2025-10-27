import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDexEnterParams } from '../types';

export class EnterScene extends BaseScene {
  /**
   * Track when user enters the new Market page
   * Logs from external pages entering market
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexEnter(params: IDexEnterParams) {
    return params;
  }
}
