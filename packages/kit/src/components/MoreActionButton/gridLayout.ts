const MAX_COLUMN_COUNT = 4;

export function buildMoreActionGridLayout<
  T extends { isPrimeFeature?: boolean },
>(
  items: readonly T[],
  isPrimeAvailable: boolean,
): Array<Array<T | null>> {
  const visibleItems = items.filter(
    (item) => !item.isPrimeFeature || isPrimeAvailable,
  );

  if (visibleItems.length === 0) {
    return [];
  }

  const rows: Array<Array<T | null>> = [];

  for (let index = 0; index < visibleItems.length; index += MAX_COLUMN_COUNT) {
    const row: Array<T | null> = visibleItems.slice(
      index,
      index + MAX_COLUMN_COUNT,
    );
    while (row.length < MAX_COLUMN_COUNT) {
      row.push(null);
    }
    rows.push(row);
  }

  return rows;
}
