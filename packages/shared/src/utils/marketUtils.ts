import { isNil, uniqBy } from 'lodash';

import type { IMarketWatchListItem } from '../../types/market';

function buildSortedMarketWatchList({
  oldList,
  addWatchListItems,
}: {
  oldList: IMarketWatchListItem[];
  addWatchListItems: IMarketWatchListItem[];
}) {
  if (isNil(oldList?.[0]?.sortIndex)) {
    oldList.forEach((item, index) => {
      item.sortIndex = item.sortIndex ?? index;
    });
  }

  const lastSortIndex = oldList[oldList.length - 1]?.sortIndex ?? 1000;

  addWatchListItems.forEach((item, index) => {
    item.sortIndex = item.sortIndex ?? lastSortIndex + index + 1;
  });

  const newList: IMarketWatchListItem[] = uniqBy(
    [...addWatchListItems, ...oldList],
    (i) => i.coingeckoId,
  ).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  return newList;
}

export default { buildSortedMarketWatchList };
