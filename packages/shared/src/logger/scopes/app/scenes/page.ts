import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public pageView(pageName: string) {
    return { pageName };
  }

  @LogToServer()
  @LogToLocal()
  public appStart() {}

  @LogToServer()
  @LogToLocal()
  public navigationToggle() {}
}
