import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IDexChartDisplayModeSwitchParams,
  IDexChartModeSwitchParams,
  IDexNativeChartIntervalParams,
  IDexSimpleChartRangeParams,
  IDexTVIndicatorParams,
  IDexTVIntervalParams,
  IDexTVLineParams,
  IDexTVPriceMCParams,
  IDexTVTimeframeParams,
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

  /**
   * Track TradingView chart time frame selection
   * Reports on click, not default selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexTVTimeFrame(params: IDexTVTimeframeParams) {
    return params;
  }

  /**
   * Track a user switch of the Market detail Pro chart between the native
   * chart and TradingView. Not sent for the persisted mode on load.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexChartModeSwitch(params: IDexChartModeSwitchParams) {
    return params;
  }

  /**
   * Track a user switch of the Market detail chart between Simple and Pro.
   * Not sent for the persisted mode on load.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexChartDisplayModeSwitch(params: IDexChartDisplayModeSwitchParams) {
    return params;
  }

  /**
   * Track a user interval pick on the Market detail native Pro chart.
   * Reports on click, not default selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexNativeChartInterval(params: IDexNativeChartIntervalParams) {
    return params;
  }

  /**
   * Track a user range pick on the Market detail Simple chart.
   * Reports on click, not default selection
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public dexSimpleChartRange(params: IDexSimpleChartRangeParams) {
    return params;
  }
}
