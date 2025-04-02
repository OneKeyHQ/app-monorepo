import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IButtonClickParams {
  /**
   * Button tracking ID or testID for identification
   */
  trackId?: string;
  /**
   * Additional custom properties
   */
  [key: string]: any;
}

export class ButtonScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public click(params: IButtonClickParams) {
    return {
      type: 'click',
      ...params,
    };
  }

  @LogToServer()
  @LogToLocal()
  public longPress(params: IButtonClickParams) {
    return {
      type: 'longPress',
      ...params,
    };
  }
}
