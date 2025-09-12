import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IDexTVIndicatorParams,
  IDexTVIntervalParams,
  IDexTVLineParams,
  IDexTVPriceMCParams,
} from '../types';

export class TradingViewScene extends BaseScene {
  /**
   * Track TradingView chart time interval selection
   * Reports on click, not default selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexTVInterval(params: IDexTVIntervalParams) {
    return params;
  }

  /**
   * Track TradingView chart K-line style selection
   * Reports according to configuration
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexTVLine(params: IDexTVLineParams) {
    return params;
  }

  /**
   * Track TradingView chart indicator selection
   * Reports according to configuration
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexTVIndicator(params: IDexTVIndicatorParams) {
    return params;
  }

  /**
   * Track TradingView price/market cap toggle
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexTVPriceMC(params: IDexTVPriceMCParams) {
    return params;
  }
}
