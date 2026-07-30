import { Empty } from '@onekeyhq/components';
import type {
  ITableColumn,
  ITableListProps,
} from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';

import { ActionField } from './ActionField';
import { AmountField } from './AmountField';
import { AssetField } from './AssetField';
import { AssetWithAmountField } from './AssetWithAmountField';
import { BorrowAPYField } from './BorrowAPYField';
import { BorrowListSkeleton, EmptyStateSkeleton } from './BorrowListSkeleton';
import { CollateralBadge } from './CollateralBadge';
import { FieldWrapper } from './FieldWrapper';

import type { ISwapConfig } from './ActionField';

/**
 * Shared column width budget for the four Borrow tables. Columns are sized by
 * flex weight, so without an upper bound a right-aligned value drifts far from
 * the column beside it: the empty part of a wide column all lands on its left.
 * Capping the value columns keeps the numbers together and hands the leftover
 * width to the asset column, which is the one that actually needs it.
 */
export const BORROW_TABLE_APY_COLUMN_MIN_WIDTH = 96;
export const BORROW_TABLE_APY_COLUMN_MAX_WIDTH = 104;
// Floors sized to the content, so the deficit can no longer be dumped on
// whichever column happens to lack a minimum.
export const BORROW_TABLE_ASSET_COLUMN_MIN_WIDTH = 100;
export const BORROW_TABLE_AMOUNT_COLUMN_MIN_WIDTH = 88;
export const BORROW_TABLE_AMOUNT_COLUMN_MAX_WIDTH = 160;
// Holds a switch, so it never needs a full column share — but it still has to
// fit its own "Collateral" header rather than truncating it.
export const BORROW_TABLE_COLLATERAL_COLUMN_FLEX = 0.6;
export const BORROW_TABLE_COLLATERAL_COLUMN_MIN_WIDTH = 76;
export const BORROW_TABLE_COLLATERAL_COLUMN_MAX_WIDTH = 88;
// Fixed rather than elastic: the column holds controls, so extra width would
// only be padding. Two sizes because reserving room for the overflow trigger
// in tables that never render one is what pushed the button out of the card.
export const BORROW_TABLE_ACTION_COLUMN_WIDTH = 140;
export const BORROW_TABLE_ACTION_COLUMN_COMPACT_WIDTH = 112;

type IBorrowTableListProps<T> = {
  columns: ITableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  estimatedItemHeight?: number;
  listProps?: Omit<ITableListProps<T>, 'columns' | 'data'>;
  emptyContent: string;
  onPressRow?: (item: T, index: number) => void;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  skeletonCount?: number;
};

const BorrowTableList = <T,>({
  columns,
  data,
  isLoading = false,
  listProps = {},
  emptyContent,
  onPressRow,
  defaultSortKey,
  defaultSortDirection,
  skeletonCount,
}: IBorrowTableListProps<T>) => {
  const hasData = data && data.length > 0;

  if (!hasData) {
    if (isLoading) {
      // Use EmptyStateSkeleton to match empty state height and prevent layout jump
      return (
        <EmptyStateSkeleton
          columns={columns}
          rowGap={listProps.rowGap}
          emptyContent={emptyContent}
        />
      );
    }
    return <Empty title={emptyContent} titleProps={{ size: '$bodyMd' }} />;
  }

  return (
    <TableList
      columns={columns}
      data={data}
      isLoading={isLoading}
      tableLayout
      withHeader
      onPressRow={onPressRow}
      defaultSortKey={defaultSortKey}
      defaultSortDirection={defaultSortDirection}
      SkeletonComponent={
        <BorrowListSkeleton
          columns={columns}
          rowGap={listProps.rowGap}
          itemCount={skeletonCount}
        />
      }
      {...listProps}
    />
  );
};

export {
  BorrowTableList,
  ActionField,
  AssetField,
  AssetWithAmountField,
  AmountField,
  BorrowAPYField,
  CollateralBadge,
  FieldWrapper,
};

export type { ISwapConfig };
