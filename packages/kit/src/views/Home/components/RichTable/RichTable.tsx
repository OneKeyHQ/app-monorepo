import type {
  ISizableTextProps,
  IStackProps,
  ITableProps,
} from '@onekeyhq/components';
import { Table } from '@onekeyhq/components';

const titleDefaultProps: ISizableTextProps = {
  size: '$headingXs',
  color: '$textSubdued',
  textTransform: 'uppercase',
};

const columnDefaultProps: IStackProps = {
  flex: 1,
  flexBasis: 0,
};

const rowDefaultProps: IStackProps = {
  py: '$2',
  px: '$3',
};

function RichTable<T>(props: ITableProps<T>) {
  const { columns, rowProps, ...rest } = props;

  const columnsWithDefaultProps = columns.map((column, index) => {
    return {
      align: index === 0 ? ('left' as const) : ('right' as const),
      ...column,
      titleProps: {
        ...titleDefaultProps,
        ...column.titleProps,
      },
      columnProps: {
        ...columnDefaultProps,
        ...column.columnProps,
      },
    };
  });

  return (
    <Table
      columns={columnsWithDefaultProps}
      rowProps={{
        ...rowDefaultProps,
        ...rowProps,
      }}
      {...rest}
    />
  );
}

export { RichTable };
