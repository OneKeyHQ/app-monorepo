import type { EdgeInsets } from 'react-native-safe-area-context';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class ComponentScene extends BaseScene {
  @LogToLocal()
  public logPortalSafeArea(
    name: string,
    insets: EdgeInsets,
    frame: { x: number; y: number; width: number; height: number },
  ) {
    return `Portal.Container [${name}] insets: ${JSON.stringify(insets)} frame: ${JSON.stringify(frame)}`;
  }

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
