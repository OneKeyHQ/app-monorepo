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
    { itemCount: 2, columnCount: 4, rowCount: 1 },
    { itemCount: 3, columnCount: 4, rowCount: 1 },
    { itemCount: 4, columnCount: 4, rowCount: 1 },
    { itemCount: 5, columnCount: 4, rowCount: 2 },
    { itemCount: 8, columnCount: 4, rowCount: 2 },
  ])(
    'lays out $itemCount items using $columnCount columns',
    ({ itemCount, columnCount, rowCount }) => {
      const layout = buildMoreActionGridLayout(buildItems(itemCount), true);

      expect(layout.columnCount).toBe(columnCount);
      expect(layout.rows).toHaveLength(rowCount);
      expect(layout.rows.every((row) => row.length === columnCount)).toBe(true);
    },
  );

  it('pads only the trailing cells in the final row', () => {
    const layout = buildMoreActionGridLayout(buildItems(5), true);

    expect(
      layout.rows.map((row) => row.map((item) => item?.id ?? null)),
    ).toEqual([
      [1, 2, 3, 4],
      [5, null, null, null],
    ]);
  });

  it('keeps incomplete rows aligned to the leading edge', () => {
    const layout = buildMoreActionGridLayout(buildItems(3), true);

    expect(layout.rows[0]?.map((item) => item?.id ?? null)).toEqual([
      1,
      2,
      3,
      null,
    ]);
  });

  it('removes unavailable Prime items before calculating columns', () => {
    const items: ITestItem[] = [
      { id: 1 },
      { id: 2, isPrimeFeature: true },
      { id: 3 },
      { id: 4, isPrimeFeature: true },
    ];

    const unavailableLayout = buildMoreActionGridLayout(items, false);
    const availableLayout = buildMoreActionGridLayout(items, true);

    expect(unavailableLayout.columnCount).toBe(4);
    expect(unavailableLayout.rows[0]?.map((item) => item?.id ?? null)).toEqual([
      1,
      3,
      null,
      null,
    ]);
    expect(availableLayout.columnCount).toBe(4);
    expect(availableLayout.rows[0]?.map((item) => item?.id ?? null)).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
