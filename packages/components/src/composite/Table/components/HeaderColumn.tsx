import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { SizableText } from '../../../primitives';
import { useSortIcon } from '../hooks';
import { getNextSortOrder } from '../utils';

import { Column } from './Column';

import type { IXStackProps } from '../../../primitives';
import type { ETableSortType, ITableColumn, ITableProps } from '../types';

interface IHeaderColumnProps<T> {
  column: ITableColumn<T>;
  index: number;
  selectedColumnName: string;
  onChangeSelectedName: (columnName: string) => void;
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
}

function HeaderColumn<T>({
  column,
  index,
  onHeaderRow,
  selectedColumnName,
  onChangeSelectedName,
}: IHeaderColumnProps<T>) {
  const {
    title,
    renderTitle,
    dataIndex,
    columnWidth = 40,
    align,
    columnProps,
    titleProps,
  } = column;
  const events = onHeaderRow?.(column, index);
  const enableSortType = !!events?.onSortTypeChange;
  const [sortOrder, setSortOrder] = useState<ETableSortType | undefined>(
    events?.initialSortOrder,
  );

  useEffect(() => {
    if (selectedColumnName !== dataIndex) {
      setSortOrder(undefined);
    }
  }, [dataIndex, selectedColumnName]);

  const handleColumnPress = useCallback(() => {
    events?.onPress?.();
    if (!enableSortType) {
      return;
    }
    const disabledSorts = events?.disableSort || [];
    const order = getNextSortOrder(sortOrder, disabledSorts);

    // When resetting to undefined, clear the selected column to allow default sorting
    if (order === undefined) {
      setTimeout(() => {
        onChangeSelectedName('');
      });
    } else {
      setTimeout(() => {
        onChangeSelectedName(dataIndex);
      });
    }

    setSortOrder(order);
    setTimeout(() => {
      events?.onSortTypeChange?.(order);
    });
  }, [dataIndex, enableSortType, events, onChangeSelectedName, sortOrder]);

  const cursor = enableSortType ? 'pointer' : undefined;
  const showSortIcon = enableSortType && !renderTitle;
  const currentSortOrder =
    dataIndex === selectedColumnName ? sortOrder : undefined;

  const { renderSortIcon: renderInlineSortIcon } = useSortIcon({
    showSortIcon: enableSortType && !!renderTitle,
    order: currentSortOrder,
    cursor,
    disabledSorts: events?.disableSort,
  });

  const textAlign = useMemo(() => {
    if (align === 'right') {
      return 'right';
    }
    return undefined;
  }, [align]);

  let titleContent;
  if (renderTitle) {
    titleContent = renderTitle(renderInlineSortIcon());
  } else if (typeof title === 'string') {
    titleContent = (
      <SizableText
        color="$textSubdued"
        size="$bodySmMedium"
        textAlign={textAlign}
        {...titleProps}
      >
        {title}
      </SizableText>
    );
  } else {
    titleContent = title;
  }

  return (
    <Column
      align={align}
      showSortIcon={showSortIcon}
      key={dataIndex}
      name={dataIndex}
      width={columnWidth}
      order={currentSortOrder}
      onPress={handleColumnPress as any}
      cursor={cursor}
      disabledSorts={events?.disableSort}
      {...(columnProps as IXStackProps)}
    >
      {titleContent}
    </Column>
  );
}

export const MemoHeaderColumn = memo(HeaderColumn);
export { HeaderColumn };
