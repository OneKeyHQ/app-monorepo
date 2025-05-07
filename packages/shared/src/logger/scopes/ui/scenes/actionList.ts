import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IActionListParams {
  /**
   * Action list tracking ID or testID for identification
   */
  trackId: string;
  /**
   * Additional custom properties
   */
  [key: string]: any;
}

export class ActionListScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public open(params: IActionListParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public close(params: IActionListParams) {
    return params;
  }
}
