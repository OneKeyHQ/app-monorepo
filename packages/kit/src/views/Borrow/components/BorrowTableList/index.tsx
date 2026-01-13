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
import { BorrowListSkeleton } from './BorrowListSkeleton';
import { FieldWrapper } from './FieldWrapper';

import type { ISwapConfig } from './ActionField';

type IBorrowTableListProps<T> = {
  columns: ITableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  estimatedItemHeight?: number;
  listProps?: Omit<ITableListProps<T>, 'columns' | 'data'>;
  emptyContent: string;
  onPressRow?: (item: T, index: number) => void;
};

const BorrowTableList = <T,>({
  columns,
  data,
  isLoading = false,
  listProps = {},
  emptyContent,
  onPressRow,
}: IBorrowTableListProps<T>) => {
  const hasData = data && data.length > 0;

  if (!hasData) {
    if (isLoading) {
      return (
        <TableList
          columns={columns}
          data={[]}
          isLoading
          tableLayout
          withHeader
          onPressRow={onPressRow}
          SkeletonComponent={
            <BorrowListSkeleton columns={columns} rowGap={listProps.rowGap} />
          }
          {...listProps}
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
      SkeletonComponent={
        <BorrowListSkeleton columns={columns} rowGap={listProps.rowGap} />
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
  FieldWrapper,
};

export type { ISwapConfig };
