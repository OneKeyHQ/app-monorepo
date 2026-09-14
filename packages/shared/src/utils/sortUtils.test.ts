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

  test('ignores items without a finite index', () => {
    expect(
      sortUtils.buildTopSortIndexes({
        oldList: [{}, { sortIndex: Number.NaN }, { sortIndex: 12 }],
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
