import type { IWebTab } from '@onekeyhq/shared/types/discovery';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserClosedTabs {
  tabs: IWebTab[];
}

export class SimpleDbEntityBrowserClosedTabs extends SimpleDbEntityBase<IBrowserClosedTabs> {
  entityName = 'browserCloseTabs';

  override enableCache = false;
}
