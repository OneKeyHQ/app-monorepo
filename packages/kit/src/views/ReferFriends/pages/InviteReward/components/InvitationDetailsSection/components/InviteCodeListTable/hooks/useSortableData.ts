import { useCallback, useMemo, useState } from 'react';

import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';

import { EInviteCodeListTableColumn } from '../const';

export type ISortableColumn =
  | EInviteCodeListTableColumn.SALES_ORDERS
  | EInviteCodeListTableColumn.ONCHAIN_WALLETS
  | EInviteCodeListTableColumn.CUMULATIVE_REWARDS
  | EInviteCodeListTableColumn.CREATED_AT;

export function useSortableData(items: IInviteCodeListItem[] | undefined) {
  const [sortBy, setSortBy] = useState<ISortableColumn | undefined>(undefined);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    undefined,
  );

  // Sort data
  const sortedData = useMemo(() => {
    if (!items || !sortBy || !sortType) {
      return items || [];
    }

    const sorted = [...items].sort((a, b) => {
      let aValue: string | number = a[sortBy];
      let bValue: string | number = b[sortBy];

      // Handle numeric sorting for rewards
      if (sortBy === EInviteCodeListTableColumn.CUMULATIVE_REWARDS) {
        aValue = parseFloat(String(aValue)) || 0;
        bValue = parseFloat(String(bValue)) || 0;
      }

      // Handle date sorting
      if (sortBy === EInviteCodeListTableColumn.CREATED_AT) {
        aValue = new Date(String(aValue)).getTime();
        bValue = new Date(String(bValue)).getTime();
      }

      if (aValue < bValue) {
        return sortType === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortType === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [items, sortBy, sortType]);

  // Handle sort change
  const handleSortChange = useCallback(
    (column: ISortableColumn, order: 'asc' | 'desc' | undefined) => {
      if (order === undefined) {
        setSortBy(undefined);
        setSortType(undefined);
      } else {
        setSortBy(column);
        setSortType(order);
      }
    },
    [],
  );

  return {
    sortedData,
    handleSortChange,
  };
}
