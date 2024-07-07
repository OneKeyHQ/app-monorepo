import { useCallback, useMemo, useRef, useState } from 'react';

const isNumericColumn = (columnValue: any) =>
  typeof columnValue === 'number' ||
  columnValue === null ||
  columnValue === '-';

const getNumericValue = (
  values: Record<string, unknown>,
  columnName: string,
  sortBy?: 'asc' | 'desc',
) => {
  const value = values[columnName];
  if (typeof value === 'number') {
    return value;
  }
  return sortBy === 'desc' ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
};

export const useSortType = (
  listData: Record<string, unknown>[],
  extraData?: any,
) => {
  const listDataRef = useRef<typeof listData | undefined>();
  const extraDataRef = useRef<any>(extraData);
  if (listDataRef.current !== listData) {
    listDataRef.current = listData;
  }
  if (extraDataRef.current !== extraData) {
    extraDataRef.current = extraData;
    listDataRef.current = listData;
  }
  const [sortByType, setSortByType] = useState<{
    columnName: string;
    order: 'asc' | 'desc' | undefined;
  }>({
    columnName: 'default',
    order: 'desc',
  });

  const handleSortTypeChange = useCallback(
    (options: { columnName: string; order: 'asc' | 'desc' | undefined }) => {
      setSortByType(options);
    },
    [],
  );

  const sortedListData = useMemo(() => {
    if (listDataRef.current?.length) {
      const columnValue = listDataRef.current[0]?.[sortByType?.columnName];
      if (sortByType?.order) {
        if (isNumericColumn(columnValue))
          return listDataRef.current?.slice().sort((a, b) => {
            const numberA = getNumericValue(
              a,
              sortByType.columnName,
              sortByType.order,
            );
            const numberB = getNumericValue(
              b,
              sortByType.columnName,
              sortByType.order,
            );
            return sortByType.order === 'desc'
              ? numberB - numberA
              : numberA - numberB;
          });
        if (typeof columnValue === 'string') {
          return listDataRef.current?.slice().sort((a, b) => {
            const stringA = a[sortByType.columnName] as string;
            const stringB = b[sortByType.columnName] as string;
            return sortByType.order === 'desc'
              ? stringA.localeCompare(stringB, 'en', { sensitivity: 'base' })
              : stringB.localeCompare(stringA, 'en', { sensitivity: 'base' });
          });
        }
        return listData;
      }
    }

    return listDataRef.current;
  }, [listData, sortByType?.columnName, sortByType?.order]);
  return useMemo(
    () => ({ sortedListData, handleSortTypeChange, sortByType, setSortByType }),
    [handleSortTypeChange, sortByType, sortedListData, setSortByType],
  );
};
