import { uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IMarketWatchListData,
  IMarketWatchListItem,
} from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityMarketWatchList extends SimpleDbEntityBase<IMarketWatchListData> {
  entityName = 'marketWatchList';

  override enableCache = false;

  async getMarketWatchList() {
    const data: IMarketWatchListData | undefined | null =
      await this.getRawData();
    return data ?? { data: [] };
  }

  async addMarketWatchList({
    watchList,
  }: {
    watchList: IMarketWatchListItem[];
  }) {
    await this.setRawData((data) => {
      const newData: IMarketWatchListData | undefined | null = {
        data: uniqBy(
          [...watchList, ...(data?.data ?? [])],
          (i) => i.coingeckoId,
        ),
      };
      return newData;
    });
  }

  async removeMarketWatchList({ coingeckoIds }: { coingeckoIds: string[] }) {
    await this.setRawData((data) => {
      const newData: IMarketWatchListData | undefined | null = {
        data:
          data?.data.filter((i) => !coingeckoIds.includes(i.coingeckoId)) ?? [],
      };
      return newData;
    });
  }
}
