import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IDialogParams {
  /**
   * Dialog tracking ID or testID for identification
   */
  trackId: string;
}

export class DialogScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public dialogOpen(params: IDialogParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public dialogClose(params: IDialogParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public dialogConfirm(params: IDialogParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public dialogCancel(params: IDialogParams) {
    return params;
  }
}
