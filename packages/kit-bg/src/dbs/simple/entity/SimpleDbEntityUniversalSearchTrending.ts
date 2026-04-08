import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IUniversalSearchTrendingCacheData,
  IUniversalSearchTrendingCacheSnapshot,
} from '@onekeyhq/shared/types/search';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityUniversalSearchTrending extends SimpleDbEntityBase<IUniversalSearchTrendingCacheData> {
  entityName = 'universalSearchTrending';

  override enableCache = true;

  @backgroundMethod()
  async getData() {
    const data = await this.getRawData();
    return data ?? { items: [] };
  }

  @backgroundMethod()
  async getDataWithMeta(): Promise<IUniversalSearchTrendingCacheSnapshot> {
    const data = await this.getData();
    return {
      items: data.items ?? [],
      updatedAt: this.updatedAt ?? 0,
      source: 'local',
      shouldKeepOnRefreshFailure: false,
    };
  }
}
