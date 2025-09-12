import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IPopoverParams {
  /**
   * Popover tracking ID or testID for identification
   */
  trackId: string;
}

export class PopoverScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public popoverOpen(params: IPopoverParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public popoverClose(params: IPopoverParams) {
    return params;
  }
}
