import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IDexListParams,
  IDexNetworkLoadingParams,
  IDexNetworkParams,
  IDexSortParams,
} from '../types';

export class ListScene extends BaseScene {
  /**
   * Track selection between trending or watchlist view
   * Only logs when user clicks trending/watchlist, not default selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexList(params: IDexListParams) {
    return params;
  }

  /**
   * Track which network list user views
   * Only logs when user clicks trending/watchlist, not default selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexNetwork(params: IDexNetworkParams) {
    return params;
  }

  /**
   * Track how many tokens loaded under specific network
   * Reports once per backend data fetch
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexNetworkLoading(params: IDexNetworkLoadingParams) {
    return params;
  }

  /**
   * Track homepage sorting selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexSort(params: IDexSortParams) {
    return params;
  }
}
