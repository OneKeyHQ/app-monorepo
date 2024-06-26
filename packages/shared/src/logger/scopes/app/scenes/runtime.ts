import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class RuntimeScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public logServiceFuncName(name: string) {
    return name;
  }
}
