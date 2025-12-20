import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class ComponentScene extends BaseScene {
  @LogToLocal()
  public renderPortalFailed(funcName: string, containerName: string) {
    return `${funcName} Can not find target PortalContainer named: ${containerName}`;
  }

  @LogToServer()
  @LogToLocal()
  public confirmedInUpdateDialog() {}

  @LogToServer()
  @LogToLocal()
  public closedInUpdateDialog() {}
}
