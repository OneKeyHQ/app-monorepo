import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public pageView(pageName: string) {
    return { pageName };
  }

  @LogToServer()
  @LogToLocal()
  public appStart() {}
}
