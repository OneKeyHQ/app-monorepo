import type { IBrowserRiskWhiteList } from '@onekeyhq/kit/src/views/Discovery/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IBrowserRiskWhiteListValue = Record<
  IBrowserRiskWhiteList['url'],
  boolean
>;

export class SimpleDbEntityBrowserRiskWhiteList extends SimpleDbEntityBase<IBrowserRiskWhiteListValue> {
  entityName = 'browserRiskWhilteList';

  override enableCache = false;
}
