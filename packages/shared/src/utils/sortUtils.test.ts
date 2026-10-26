import sortUtils from './sortUtils';

describe('sortUtils.buildTopSortIndexes', () => {
  test('places new items above the lowest existing index, later entries higher', () => {
    expect(
      sortUtils.buildTopSortIndexes({
        oldList: [{ sortIndex: 7 }, { sortIndex: 5 }, { sortIndex: 6 }],
        count: 2,
      }),
    ).toEqual([4, 3]);
  });

  test('treats a missing index as 0, the way the watchlist sorts it', () => {
    // Legacy favorites without a sortIndex sort as 0, so a new favorite has to
    // land below 0 to reach the top.
    expect(
      sortUtils.buildTopSortIndexes({
        oldList: [{}, { sortIndex: 12 }],
        count: 1,
      }),
    ).toEqual([-1]);
  });

  test('ignores a non-finite index', () => {
    expect(
      sortUtils.buildTopSortIndexes({
        oldList: [{ sortIndex: Number.NaN }, { sortIndex: 12 }],
        count: 1,
      }),
    ).toEqual([11]);
  });

  test('starts below 1000 for an empty list', () => {
    expect(sortUtils.buildTopSortIndexes({ oldList: [], count: 1 })).toEqual([
      999,
    ]);
  });
});

describe('sortUtils.buildOrderedTopSortIndexes', () => {
  test('keeps the given order above the lowest existing index', () => {
    expect(
      sortUtils.buildOrderedTopSortIndexes({
        oldList: [{ sortIndex: 7 }, { sortIndex: 5 }, { sortIndex: 6 }],
        count: 3,
      }),
    ).toEqual([2, 3, 4]);
  });

  test('treats a missing index as 0', () => {
    expect(
      sortUtils.buildOrderedTopSortIndexes({
        oldList: [{}],
        count: 2,
      }),
    ).toEqual([-2, -1]);
  });

  test('starts below 1000 for an empty list, first entry lowest', () => {
    expect(
      sortUtils.buildOrderedTopSortIndexes({ oldList: [], count: 3 }),
    ).toEqual([997, 998, 999]);
  });
});
