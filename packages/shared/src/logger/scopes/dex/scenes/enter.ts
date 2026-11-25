import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDexEnterParams, IDexLeaveParams } from '../types';

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

  /**
   * Track leaving a Market detail page. Sent once for each detail
   * `dexEnter`, with the foreground time spent on the focused page.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexLeave(params: IDexLeaveParams) {
    return params;
  }
}
