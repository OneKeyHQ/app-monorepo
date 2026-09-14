import { isNil, uniqBy } from 'lodash';

function buildNewSortIndex(payload: {
  target: {
    sortIndex?: number;
  };
  prev:
    | {
        sortIndex?: number;
      }
    | undefined;
  next:
    | {
        sortIndex?: number;
      }
    | undefined;
}) {
  const { target, prev, next } = payload;
  let newSortIndex = target?.sortIndex ?? 1000 + Math.random();
  if (prev && !next) {
    newSortIndex = (prev.sortIndex ?? newSortIndex) + 1 + Math.random();
  } else if (!prev && next) {
    newSortIndex = (next.sortIndex ?? newSortIndex) - 1 - Math.random();
  } else {
    newSortIndex =
      ((prev?.sortIndex ?? newSortIndex - 1) +
        (next?.sortIndex ?? newSortIndex + 1)) /
      2;
  }
  return newSortIndex;
}

function fillingMissingSortIndex<T extends { sortIndex?: number }>({
  items,
}: {
  items: T[];
}) {
  items.forEach((item, index) => {
    item.sortIndex = item.sortIndex ?? index + Math.random();
  });
  return { items };
}

function fillingSaveItemsSortIndex<T extends { sortIndex?: number }>({
  oldList,
  saveItems,
}: {
  oldList: T[];
  saveItems: T[];
}) {
  const firstItem = oldList?.[0];
  const lastItem = oldList?.[oldList.length - 1];
  const hasMissingSortIndex =
    isNil(firstItem?.sortIndex) || isNil(lastItem?.sortIndex);

  if (hasMissingSortIndex) {
    fillingMissingSortIndex({ items: oldList });
  }

  const lastSortIndex =
    oldList[oldList.length - 1]?.sortIndex ?? 1000 + Math.random();

  saveItems.forEach((item, index) => {
    item.sortIndex =
      item.sortIndex ?? lastSortIndex + index + 1 + Math.random();
  });

  return saveItems;
}

function buildSortedList<T extends { sortIndex?: number }>({
  oldList,
  saveItems,
  uniqByFn,
}: {
  oldList: T[];
  saveItems: T[];
  uniqByFn: (item: T) => string | number;
}) {
  // eslint-disable-next-line no-param-reassign
  saveItems = fillingSaveItemsSortIndex({ oldList, saveItems });

  const newList: T[] = uniqBy([...saveItems, ...oldList], uniqByFn).toSorted(
    (a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0),
  );

  return newList;
}

/**
 * Sort indexes that place `count` new items above everything already in the
 * list: the watchlist's newest-favorite-first rule. Later entries land higher,
 * so an oldest-first batch reads newest-first once sorted.
 */
function buildTopSortIndexes({
  oldList,
  count,
}: {
  oldList: { sortIndex?: number }[];
  count: number;
}): number[] {
  const existingSortIndexes = oldList
    .map((item) => item.sortIndex)
    .filter((sortIndex): sortIndex is number => Number.isFinite(sortIndex));
  const topSortIndex = existingSortIndexes.length
    ? Math.min(...existingSortIndexes)
    : 1000;
  return Array.from(
    { length: count },
    (_, index) => topSortIndex - (index + 1),
  );
}

export default {
  buildNewSortIndex,
  buildTopSortIndexes,
  buildSortedList,
  fillingSaveItemsSortIndex,
  fillingMissingSortIndex,
};
