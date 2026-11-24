import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { EMarketHomeEntrySource } from '../marketHomeEntry';

export class MarketHomeScene extends BaseScene {
  /**
   * Track each entry into the Market home, whichever path switched to it.
   * Returning to the home from a page or modal above it is not an entry.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public marketHomeView(params: {
    entrySource: EMarketHomeEntrySource;
    isFirstView: boolean;
  }) {
    return params;
  }
}
