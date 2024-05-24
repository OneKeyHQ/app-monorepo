import type { IMarketWatchListData } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export class SimpleDbEntityMarketWatchList extends SimpleDbEntityBase<IMarketWatchListData> {
  entityName = 'marketWatchList';

  override enableCache = false;
}
