import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HardwareLiteCardScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(message: string, ...info: any[]) {
    return {
      message,
      ...info,
    };
  }
}
