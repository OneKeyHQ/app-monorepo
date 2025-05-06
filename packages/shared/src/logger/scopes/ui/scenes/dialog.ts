import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IDialogParams {
  /**
   * Dialog tracking ID or testID for identification
   */
  trackId?: string;
  /**
   * Additional custom properties
   */
  [key: string]: any;
}

export class DialogScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public open(params: IDialogParams) {
    return {
      type: 'open',
      ...params,
    };
  }

  @LogToServer()
  @LogToLocal()
  public close(params: IDialogParams) {
    return {
      type: 'close',
      ...params,
    };
  }

  @LogToServer()
  @LogToLocal()
  public confirm(params: IDialogParams) {
    return {
      type: 'confirm',
      ...params,
    };
  }

  @LogToServer()
  @LogToLocal()
  public cancel(params: IDialogParams) {
    return {
      type: 'cancel',
      ...params,
    };
  }
}
