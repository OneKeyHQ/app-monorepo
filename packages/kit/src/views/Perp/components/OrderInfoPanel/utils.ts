import type { IColumnConfig } from './List/CommonTableListView';

export type IPerpFillDirectionType =
  | 'openLong'
  | 'openShort'
  | 'closeLong'
  | 'closeShort'
  | 'unknown';

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

export const getPerpFillDirectionType = (
  direction?: string,
): IPerpFillDirectionType => {
  const normalizedDirection = direction?.trim().toLowerCase() ?? '';

  if (normalizedDirection.includes('close long')) {
    return 'closeLong';
  }

  if (normalizedDirection.includes('close short')) {
    return 'closeShort';
  }

  if (normalizedDirection.includes('long')) {
    return 'openLong';
  }

  if (normalizedDirection.includes('short')) {
    return 'openShort';
  }

  return 'unknown';
};
