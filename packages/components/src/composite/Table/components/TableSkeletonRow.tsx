export interface ITableSkeletonRowProps {
  columns: any[];
  index: number;
  rowProps?: any;
  TableRowComponent: React.ComponentType<any>;
}

export function TableSkeletonRow({
  columns,
  index,
  rowProps,
  TableRowComponent,
}: ITableSkeletonRowProps) {
  return (
    <TableRowComponent
      columns={columns}
      showSkeleton
      rowProps={rowProps}
      item={undefined as any}
      key={index}
      index={index}
    />
  );
}
