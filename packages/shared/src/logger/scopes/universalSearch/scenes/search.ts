import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IUniversalSearchParams } from '../types';

export class SearchScene extends BaseScene {
  /**
   * Track when user performs a search
   * Used to understand what users are searching for (trending topics)
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public universalSearchQuery(params: IUniversalSearchParams) {
    return params;
  }
}
