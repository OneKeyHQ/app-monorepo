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
  // eslint-disable-next-line @typescript-eslint/no-empty-function, no-empty-function
  public async appStart() {}
}
