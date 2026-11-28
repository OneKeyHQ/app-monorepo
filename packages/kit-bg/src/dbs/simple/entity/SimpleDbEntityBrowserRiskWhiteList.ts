import type { IBrowserRiskWhiteList } from '@onekeyhq/shared/types/discovery';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IBrowserRiskWhiteListValue = Record<
  IBrowserRiskWhiteList['url'],
  boolean
>;

export class SimpleDbEntityBrowserRiskWhiteList extends SimpleDbEntityBase<IBrowserRiskWhiteListValue> {
  entityName = 'browserRiskWhilteList';

  override enableCache = false;
}
