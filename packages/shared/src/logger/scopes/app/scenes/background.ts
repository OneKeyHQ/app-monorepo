import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';
import { NO_LOG_OUTPUT } from '../../../types';

export class BackgroundScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public call(serviceAndMethodName: string) {
    if (['serviceSetting.refreshLastActivity'].includes(serviceAndMethodName)) {
      return NO_LOG_OUTPUT;
    }
    return `${serviceAndMethodName}`;
  }
}
