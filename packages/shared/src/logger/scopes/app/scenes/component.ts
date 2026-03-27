import type { Metrics } from 'react-native-safe-area-context';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class ComponentScene extends BaseScene {
  @LogToLocal()
  public logPortalContainer(
    name: string,
    initialWindowMetrics: Metrics | null,
  ) {
    return `Portal.Container [${name}] initialWindowMetrics: ${JSON.stringify(initialWindowMetrics)}`;
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
