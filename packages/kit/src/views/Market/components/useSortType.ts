import { useCallback, useMemo, useRef, useState } from 'react';

export const useSortType = (
  listData: Record<string, unknown>[],
  extraData?: any,
) => {
  const listDataRef = useRef<typeof listData | undefined>();
  const extraDataRef = useRef<any>(extraData);
  if (!listDataRef.current && listData?.length) {
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
    const columnValue = listDataRef.current?.[0]?.[sortByType.columnName];
    if (columnValue) {
      if (sortByType.order) {
        if (typeof columnValue === 'number')
          return listDataRef.current?.slice().sort((a, b) => {
            const numberA = a[sortByType.columnName] as number;
            const numberB = b[sortByType.columnName] as number;
            return sortByType.order === 'desc'
              ? numberB - numberA
              : numberA - numberB;
          });
        if (typeof columnValue === 'string') {
          return listDataRef.current?.slice().sort((a, b) => {
            const stringA = a[sortByType.columnName] as string;
            const stringB = b[sortByType.columnName] as string;
            return sortByType.order === 'desc'
              ? stringA.charCodeAt(0) - stringB.charCodeAt(0)
              : stringB.charCodeAt(0) - stringA.charCodeAt(0);
          });
        }
        return listData;
      }
    }

    return listData;
  }, [listData, sortByType.columnName, sortByType.order]);
  return useMemo(
    () => ({ sortedListData, handleSortTypeChange, sortByType, setSortByType }),
    [handleSortTypeChange, sortByType, sortedListData, setSortByType],
  );
};
