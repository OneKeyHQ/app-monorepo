import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';
import { getSearchTypeTrackingName } from '../types';

import type {
  ISearchResultClickParams,
  IUniversalSearchParams,
} from '../types';

export class SearchScene extends BaseScene {
  /**
   * Track when user performs a search
   * Includes per-type result breakdown for exposure/reach rate analysis
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public universalSearchQuery(params: IUniversalSearchParams) {
    return params;
  }

  /**
   * Track when user clicks a search result
   * Represents completed feature reach
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public universalSearchClick(params: ISearchResultClickParams) {
    return {
      ...params,
      type: getSearchTypeTrackingName(params.type),
    };
  }
}
