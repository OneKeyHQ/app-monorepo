import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IButtonClickParams {
  /**
   * Button tracking ID or testID for identification
   */
  id?: string;
  /**
   * Component or screen where the button was clicked
   */
  source?: string;
  /**
   * Additional custom properties
   */
  [key: string]: any;
}

export class ButtonScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public click(params: IButtonClickParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public longPress(params: IButtonClickParams) {
    return params;
  }
}
