const MAX_COLUMN_COUNT = 4;

export function buildMoreActionGridLayout<
  T extends { isPrimeFeature?: boolean },
>(items: readonly T[], isPrimeAvailable: boolean) {
  const visibleItems = items.filter(
    (item) => !item.isPrimeFeature || isPrimeAvailable,
  );

  if (visibleItems.length === 0) {
    return {
      columnCount: 0,
      rows: [] as Array<Array<T | null>>,
    };
  }

  const columnCount = MAX_COLUMN_COUNT;
  const rows: Array<Array<T | null>> = [];

  for (let index = 0; index < visibleItems.length; index += columnCount) {
    const row: Array<T | null> = visibleItems.slice(index, index + columnCount);
    while (row.length < columnCount) {
      row.push(null);
    }
    rows.push(row);
  }

  return {
    columnCount,
    rows,
  };
}
