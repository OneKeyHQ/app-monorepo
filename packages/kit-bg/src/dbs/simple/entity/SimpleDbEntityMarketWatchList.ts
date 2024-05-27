import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IMarketWatchListData } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export class SimpleDbEntityMarketWatchList extends SimpleDbEntityBase<IMarketWatchListData> {
  entityName = 'marketWatchList';

  override enableCache = false;

  @backgroundMethod()
  async getMarketWatchList() {
    const data = await this.getRawData();
    return data ?? { data: [] };
  }
}
