import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDexButtonTabParams, IDexIntervalParams } from '../types';

export class ChartScene extends BaseScene {
  /**
   * Track token interval data switching
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexInterval(params: IDexIntervalParams) {
    return params;
  }

  /**
   * Track bottom information tab clicks
   * Reports once per tab click, not default
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexButtonTab(params: IDexButtonTabParams) {
    return params;
  }
}
