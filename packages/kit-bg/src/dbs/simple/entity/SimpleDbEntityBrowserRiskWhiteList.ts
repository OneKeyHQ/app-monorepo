import type { IBrowserRiskWhiteList } from '@onekeyhq/kit/src/views/Discovery/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IBrowserRiskWhiteListValue {
  data: IBrowserRiskWhiteList[];
}

export class SimpleDbEntityBrowserRiskWhiteList extends SimpleDbEntityBase<IBrowserRiskWhiteListValue> {
  entityName = 'browserRiskWhilteList';

  override enableCache = false;
}
