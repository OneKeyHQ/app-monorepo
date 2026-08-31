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
  // Controlled mode: the order comes from the parent and no internal sort
  // state is kept, so external sort actions stay reflected in the arrows.
  isSortControlled?: boolean;
  controlledOrder?: ETableSortType;
}

function HeaderColumn<T>({
  column,
  index,
  onHeaderRow,
  selectedColumnName,
  onChangeSelectedName,
  isSortControlled,
  controlledOrder,
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

  let currentSortOrder: ETableSortType | undefined;
  if (isSortControlled) {
    currentSortOrder = controlledOrder;
  } else if (dataIndex === selectedColumnName) {
    currentSortOrder = sortOrder;
  }

  useEffect(() => {
    if (isSortControlled) {
      return;
    }
    if (selectedColumnName !== dataIndex) {
      setSortOrder(undefined);
    }
  }, [dataIndex, selectedColumnName, isSortControlled]);

  const handleColumnPress = useCallback(() => {
    events?.onPress?.();
    if (!enableSortType) {
      return;
    }
    const disabledSorts = events?.disableSort || [];
    const order = getNextSortOrder(currentSortOrder, disabledSorts);

    // Controlled mode owns no local state: just report the next order and let
    // the parent's re-render drive the arrow.
    if (isSortControlled) {
      events?.onSortTypeChange?.(order);
      return;
    }

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
  }, [
    dataIndex,
    enableSortType,
    events,
    onChangeSelectedName,
    currentSortOrder,
    isSortControlled,
  ]);

  const cursor = enableSortType ? 'pointer' : undefined;
  const showSortIcon = enableSortType && !renderTitle;

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
    titleContent = renderTitle(renderInlineSortIcon(), {
      order: currentSortOrder,
      onSortPress: enableSortType
        ? (handleColumnPress as () => void)
        : undefined,
    });
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
