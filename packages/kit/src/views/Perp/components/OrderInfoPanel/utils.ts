import type { IColumnConfig } from './List/CommonTableListView';

export const calcCellAlign = (align?: string) => {
  if (align === 'left') {
    return 'flex-start';
  }
  if (align === 'right') {
    return 'flex-end';
  }
  return 'center';
};

export const getColumnStyle = (column: IColumnConfig) => {
  const isFixedWidth = !!column.width;
  return {
    width: isFixedWidth ? column.width : undefined,
    minWidth: isFixedWidth ? undefined : column.minWidth,
    flexGrow: isFixedWidth ? undefined : column.flex || 1,
    flexBasis: isFixedWidth ? undefined : 0,
  };
};
