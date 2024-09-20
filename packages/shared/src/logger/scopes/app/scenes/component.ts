import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class ComponentScene extends BaseScene {
  @LogToLocal()
  public renderPortalFailed(funcName: string, containerName: string) {
    return `${funcName} Can not find target PortalContainer named: ${containerName}`;
  }

  @LogToLocal()
  public logDialogShowKeyboardEvent(e: any) {
    return JSON.stringify(e);
  }

  @LogToLocal()
  public logDialogDismissKeyboardEvent() {}
}
