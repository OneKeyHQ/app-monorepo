import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDexBannerEnterParams } from '../types';

export class BannerScene extends BaseScene {
  /**
   * Track when user clicks a banner in the DEX/Market page
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexBannerEnter(params: IDexBannerEnterParams) {
    return params;
  }
}
