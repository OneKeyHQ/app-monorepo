import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserClosedTabs {
  tabs: IWebTab[];
}

export class SimpleDbEntityBrowserClosedTabs extends SimpleDbEntityBase<IBrowserClosedTabs> {
  entityName = 'browserCloseTabs';

  override enableCache = false;
}
