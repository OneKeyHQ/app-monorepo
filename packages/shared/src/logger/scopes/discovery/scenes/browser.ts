import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class BrowserScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public tabsData(tabs: IWebTab[]) {
    return JSON.stringify(tabs);
  }

  @LogToLocal({ level: 'info' })
  public setTabsDataFunctionName(fnName: string) {
    return fnName;
  }
}
