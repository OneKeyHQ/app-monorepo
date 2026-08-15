import { buildMoreActionGridLayout } from './gridLayout';

type ITestItem = {
  id: number;
  isPrimeFeature?: boolean;
};

function buildItems(count: number): ITestItem[] {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
}

describe('buildMoreActionGridLayout', () => {
  it.each([
    { itemCount: 2, rowCount: 1 },
    { itemCount: 3, rowCount: 1 },
    { itemCount: 4, rowCount: 1 },
    { itemCount: 5, rowCount: 2 },
    { itemCount: 8, rowCount: 2 },
  ])(
    'chunks $itemCount items into $rowCount rows of 4',
    ({ itemCount, rowCount }) => {
      const rows = buildMoreActionGridLayout(buildItems(itemCount), true);

      expect(rows).toHaveLength(rowCount);
      expect(rows.every((row) => row.length === 4)).toBe(true);
    },
  );

  it('pads only the trailing cells in the final row', () => {
    const rows = buildMoreActionGridLayout(buildItems(5), true);

    expect(rows.map((row) => row.map((item) => item?.id ?? null))).toEqual([
      [1, 2, 3, 4],
      [5, null, null, null],
    ]);
  });

  it('keeps incomplete rows aligned to the leading edge', () => {
    const rows = buildMoreActionGridLayout(buildItems(3), true);

    expect(rows[0]?.map((item) => item?.id ?? null)).toEqual([1, 2, 3, null]);
  });

  it('filters unavailable Prime items before chunking rows', () => {
    const items: ITestItem[] = [
      { id: 1 },
      { id: 2, isPrimeFeature: true },
      { id: 3 },
      { id: 4, isPrimeFeature: true },
    ];

    const unavailableRows = buildMoreActionGridLayout(items, false);
    const availableRows = buildMoreActionGridLayout(items, true);

    expect(unavailableRows[0]?.map((item) => item?.id ?? null)).toEqual([
      1,
      3,
      null,
      null,
    ]);
    expect(availableRows[0]?.map((item) => item?.id ?? null)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('returns no rows when every item is filtered out', () => {
    const rows = buildMoreActionGridLayout(
      [{ id: 1, isPrimeFeature: true }],
      false,
    );

    expect(rows).toEqual([]);
  });

  it('returns no rows for an empty item list', () => {
    expect(buildMoreActionGridLayout<ITestItem>([], true)).toEqual([]);
  });
});
