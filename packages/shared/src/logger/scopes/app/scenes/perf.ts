import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class AppPerfScene extends BaseScene {
  @LogToConsole()
  public logTime(params: { message: string; data?: any }) {
    return [params];
  }
}
