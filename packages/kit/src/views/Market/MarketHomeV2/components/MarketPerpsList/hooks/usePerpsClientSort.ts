import { useCallback, useMemo, useState } from 'react';

import type { ITableColumn, ITableControlledSort } from '@onekeyhq/components';
import { ETableSortType } from '@onekeyhq/components';

import type { IMarketPerpsToken } from './marketPerpsTokenUtils';

// dataIndex (table column) -> the perps field it renders. `name` is absent on
// purpose: the first column is not sortable outside trending.
const PERPS_CLIENT_SORT_FIELD_MAP: Record<string, keyof IMarketPerpsToken> = {
  price: 'markPrice',
  change24h: 'change24hPercent',
  volume24h: 'volume24h',
  openInterest: 'openInterest',
  fundingRate: 'fundingRate',
};

function isMissingSortValue(value: unknown): boolean {
  return (
    value === undefined || value === null || !Number.isFinite(Number(value))
  );
}

// The perps list arrives as one full category pool, so sorting locally covers
// every row the tab can show. Values are numeric strings off the wire.
function sortPerpsTokens(
  tokens: IMarketPerpsToken[],
  field: keyof IMarketPerpsToken,
  direction: 'asc' | 'desc',
): IMarketPerpsToken[] {
  return tokens.toSorted((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    const aMissing = isMissingSortValue(aVal);
    const bMissing = isMissingSortValue(bVal);
    if (aMissing || bMissing) {
      if (aMissing && bMissing) return 0;
      // Missing values always sink to the bottom in both directions.
      return aMissing ? 1 : -1;
    }
    const result = Number(aVal) - Number(bVal);
    return direction === 'asc' ? result : -result;
  });
}

export function usePerpsClientSort({
  tokens,
}: {
  tokens: IMarketPerpsToken[];
}) {
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    undefined,
  );

  const sortedTokens = useMemo(() => {
    if (!sortBy || !sortType) {
      return tokens;
    }
    const field = PERPS_CLIENT_SORT_FIELD_MAP[sortBy];
    if (!field) {
      return tokens;
    }
    return sortPerpsTokens(tokens, field, sortType);
  }, [sortBy, sortType, tokens]);

  const onHeaderRow = useCallback(
    (column: ITableColumn<IMarketPerpsToken>) => {
      const columnKey = String(column.dataIndex);
      if (!PERPS_CLIENT_SORT_FIELD_MAP[columnKey]) {
        return undefined;
      }
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          setSortBy(order ? columnKey : undefined);
          setSortType(order);
        },
        initialSortOrder:
          sortBy === columnKey ? (sortType as ETableSortType) : undefined,
      };
    },
    [sortBy, sortType],
  );

  // The desktop layout renders a portalled header alongside the table's own,
  // so the order has to come from here rather than each header's local state.
  const controlledSort = useMemo<ITableControlledSort | undefined>(() => {
    if (!sortBy || !sortType) {
      return null;
    }
    return {
      dataIndex: sortBy,
      order: sortType === 'asc' ? ETableSortType.ASC : ETableSortType.DESC,
    };
  }, [sortBy, sortType]);

  return { sortedTokens, onHeaderRow, controlledSort };
}
