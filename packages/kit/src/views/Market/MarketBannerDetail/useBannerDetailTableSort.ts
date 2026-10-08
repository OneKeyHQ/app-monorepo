import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ETableSortType,
  ITableColumn,
  ITableProps,
} from '@onekeyhq/components';

import { sortMarketTokenListData } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

type IBannerDetailSort<T> = {
  dataIndex: string;
  field: keyof T;
  order: 'asc' | 'desc';
};

// The banner endpoints answer with the whole list and take no sort params, so
// the desktop tables sort in place, the way the outer trending and perps
// lists do.
export function useBannerDetailTableSort<T>({
  data,
  columns,
  sortableFields,
}: {
  data: T[];
  columns: ITableColumn<T>[];
  sortableFields: Readonly<Record<string, keyof T>>;
}): {
  sortedData: T[];
  handleHeaderRow: NonNullable<ITableProps<T>['onHeaderRow']>;
} {
  const [sort, setSort] = useState<IBannerDetailSort<T>>();

  // The responsive layout can drop the sorted column; keep the rows in their
  // server order rather than sorted by a header the user can no longer see.
  useEffect(() => {
    if (
      sort &&
      !columns.some((column) => String(column.dataIndex) === sort.dataIndex)
    ) {
      setSort(undefined);
    }
  }, [columns, sort]);

  const handleHeaderRow = useCallback<
    NonNullable<ITableProps<T>['onHeaderRow']>
  >(
    (column) => {
      const dataIndex = String(column.dataIndex);
      const field = sortableFields[dataIndex];
      if (!field) {
        return undefined;
      }
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          setSort(order ? { dataIndex, field, order } : undefined);
        },
        initialSortOrder:
          sort?.dataIndex === dataIndex
            ? (sort.order as ETableSortType)
            : undefined,
      };
    },
    [sort, sortableFields],
  );

  const sortedData = useMemo(
    () =>
      sort
        ? sortMarketTokenListData({
            data,
            field: sort.field,
            order: sort.order,
          })
        : data,
    [data, sort],
  );

  return { sortedData, handleHeaderRow };
}
