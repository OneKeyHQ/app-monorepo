import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'debug' })
  public pageView(pageName: string) {
    return { pageName };
  }

  public appStart() {}
}
