import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IActionListParams {
  /**
   * Action list tracking ID or testID for identification
   */
  trackId: string;
}

export class ActionListScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public actionListOpen(params: IActionListParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public actionListClose(params: IActionListParams) {
    return params;
  }
}
