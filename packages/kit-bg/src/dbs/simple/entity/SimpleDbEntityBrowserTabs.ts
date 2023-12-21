import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IBrowserTabs {
  tabs: IWebTab[];
}

export class SimpleDbEntityBrowserTabs extends SimpleDbEntityBase<IBrowserTabs> {
  entityName = 'browserTabs';

  override enableCache = true;
}
