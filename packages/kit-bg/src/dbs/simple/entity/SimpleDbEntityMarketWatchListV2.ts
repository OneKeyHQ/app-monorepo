import { Semaphore } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  getMarketWatchlistKey,
  isValidMarketWatchlistItem,
} from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import type {
  IMarketWatchListDataV2,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import { SimpleDbEntityMarketListingWatchList } from './SimpleDbEntityMarketListingWatchList';

function isListing(item: IMarketWatchListItemV2) {
  return item.assetId !== undefined || item.stockId !== undefined;
}

export class SimpleDbEntityMarketWatchListV2 extends SimpleDbEntityBase<IMarketWatchListDataV2> {
  entityName = 'marketWatchListV2';

  override enableCache = false;

  private listingDb = new SimpleDbEntityMarketListingWatchList();

  private watchListMutex = new Semaphore(1);

  private async migrateListings(): Promise<void> {
    const raw = await this.getRawData();
    const listings = (raw?.data ?? []).filter(
      (item) => isListing(item) && isValidMarketWatchlistItem(item),
    );
    if (!listings.length) return;

    // Save first so an interrupted migration can retry without losing favorites.
    const saved = await this.listingDb.setRawData((data) => ({
      data: sortUtils.buildSortedList({
        oldList: listings,
        saveItems: data?.data ?? [],
        uniqByFn: getMarketWatchlistKey,
      }),
    }));
    if (!saved) {
      throw new OneKeyLocalError('Market listing migration was not persisted');
    }
    const cleaned = await this.setRawData((data) => ({
      data: (data?.data ?? []).filter((item) => !isListing(item)),
    }));
    if (!cleaned) {
      throw new OneKeyLocalError(
        'Market listing migration cleanup was not persisted',
      );
    }
  }

  async getMarketWatchListV2(): Promise<IMarketWatchListDataV2> {
    return this.watchListMutex.runExclusive(async () => {
      await this.migrateListings();
      const legacy = await this.getRawData();
      const cleanLegacy = (legacy?.data ?? []).filter(
        isValidMarketWatchlistItem,
      );
      if (cleanLegacy.length !== (legacy?.data.length ?? 0)) {
        await this.setRawData((data) => ({
          data: (data?.data ?? []).filter(isValidMarketWatchlistItem),
        }));
      }
      const listings = await this.listingDb.getRawData();
      return {
        data: [...cleanLegacy, ...(listings?.data ?? [])]
          .filter(isValidMarketWatchlistItem)
          .toSorted((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
      };
    });
  }

  async getMarketWatchListItemV2(
    identity: IMarketWatchListItemV2,
  ): Promise<IMarketWatchListItemV2 | undefined> {
    const watchList = await this.getMarketWatchListV2();
    return watchList.data.find(
      (item) => getMarketWatchlistKey(item) === getMarketWatchlistKey(identity),
    );
  }

  // addOrEdit
  async addMarketWatchListV2({
    watchList,
    callerName,
  }: {
    watchList: IMarketWatchListItemV2[];
    callerName: string;
  }) {
    defaultLogger.cloudSync.market.simpleDbAddWatchListItems({
      callerName,
      items: watchList,
    });
    await this.watchListMutex.runExclusive(async () => {
      await this.migrateListings();
      const stores: [
        SimpleDbEntityBase<IMarketWatchListDataV2>,
        IMarketWatchListItemV2[],
      ][] = [
        [this, watchList.filter((item) => !isListing(item))],
        [this.listingDb, watchList.filter(isListing)],
      ];
      for (const [db, items] of stores) {
        if (items.length) {
          await db.setRawData((data) => ({
            data: sortUtils.buildSortedList({
              oldList: data?.data ?? [],
              saveItems: items.filter(isValidMarketWatchlistItem),
              uniqByFn: getMarketWatchlistKey,
            }),
          }));
        }
      }
    });
  }

  async removeMarketWatchListV2({
    items,
    callerName,
  }: {
    items: IMarketWatchListItemV2[];
    callerName: string;
  }) {
    defaultLogger.cloudSync.market.simpleDbRemoveWatchListItems({
      callerName,
      items,
    });
    await this.watchListMutex.runExclusive(async () => {
      await this.migrateListings();
      const stores: SimpleDbEntityBase<IMarketWatchListDataV2>[] = [
        this,
        this.listingDb,
      ];
      for (const db of stores) {
        await db.setRawData((data) => ({
          data: (data?.data ?? []).filter(
            (item) =>
              !items.some(
                (removed) =>
                  getMarketWatchlistKey(item) ===
                  getMarketWatchlistKey(removed),
              ),
          ),
        }));
      }
    });
  }

  async clearAllMarketWatchListV2() {
    defaultLogger.cloudSync.market.simpleDbClearAllWatchListItems();
    await this.watchListMutex.runExclusive(async () => {
      await this.migrateListings();
      await this.setRawData(() => ({ data: [] }));
      await this.listingDb.setRawData(() => ({ data: [] }));
    });
  }
}
