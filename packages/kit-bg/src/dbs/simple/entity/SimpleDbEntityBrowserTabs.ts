import type { IWebTab } from '@onekeyhq/shared/types/discovery';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserTabs {
  tabs: IWebTab[];
}

export class SimpleDbEntityBrowserTabs extends SimpleDbEntityBase<IBrowserTabs> {
  entityName = 'browserTabs';

  override enableCache = true;
}
