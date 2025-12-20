import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IDexAddToWatchlistParams,
  IDexRemoveFromWatchlistParams,
} from '../types';

export class WatchlistScene extends BaseScene {
  /**
   * Track adding individual token to watchlist
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexAddToWatchlist(params: IDexAddToWatchlistParams) {
    return params;
  }

  /**
   * Track removing token from watchlist
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexRemoveFromWatchlist(params: IDexRemoveFromWatchlistParams) {
    return params;
  }
}
