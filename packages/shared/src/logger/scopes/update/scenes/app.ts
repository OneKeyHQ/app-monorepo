import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class AppScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(eventName: string, version: number | string = '') {
    return `${eventName} ${version}`;
  }
}
