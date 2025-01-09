import { addBreadcrumb } from '@onekeyhq/shared/src/modules3rdParty/sentry';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public pageView(pageName: string) {
    setTimeout(() => {
      addBreadcrumb({
        category: 'page',
        message: pageName,
        level: 'info',
      });
    });
    return { pageName };
  }

  @LogToServer()
  @LogToLocal()
  public appStart() {}

  @LogToServer()
  @LogToLocal()
  public navigationToggle() {}
}
