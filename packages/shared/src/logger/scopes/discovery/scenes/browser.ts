import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class BrowserScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public tabsData(tabs: IWebTab[]) {
    return JSON.stringify(tabs);
  }

  @LogToLocal({ level: 'info' })
  public setTabsDataFunctionName(fnName: string) {
    return fnName;
  }

  @LogToLocal({ level: 'info' })
  public logRejectUrl(url: string) {
    return url;
  }
}
