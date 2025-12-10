import { Empty, Skeleton } from '@onekeyhq/components';
import type {
  ITableColumn,
  ITableListProps,
} from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';

import { AmountField } from './AmountField';
import { AssetField } from './AssetField';
import { BorrowAPYField } from './BorrowAPYField';
import { FieldWrapper } from './FieldWrapper';

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
  if (isLoading) {
    return <Skeleton height={200} />;
  }

  if (!data || data.length === 0) {
    return <Empty title={emptyContent} />;
  }

  return (
    <TableList
      columns={columns}
      data={data}
      tableLayout
      withHeader
      onPressRow={onPressRow}
      {...listProps}
    />
  );
};

export {
  BorrowTableList,
  AssetField,
  AmountField,
  BorrowAPYField,
  FieldWrapper,
};
