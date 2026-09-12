import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Tooltip } from '../../../actions/Tooltip';
import { DashText } from '../../../content/DashText';
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
    titleTooltip,
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

  useEffect(() => {
    setSortOrder(events?.initialSortOrder);
  }, [events?.initialSortOrder]);

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
    dataIndex === selectedColumnName ? sortOrder : events?.initialSortOrder;

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

  const tooltipTrigger = useMemo(
    () => (
      <DashText
        color="$textSubdued"
        size="$bodySmMedium"
        textAlign={textAlign}
        dashThickness={0.5}
        dashSpacing={0}
        dashColor="$neutral8"
        // Decoration, not layout: the header keeps the height of a plain
        // title so a dashed one sits on the same line as the rest.
        dashOverlay
        cursor={cursor}
        {...titleProps}
      >
        {typeof title === 'string' ? title : ''}
      </DashText>
    ),
    [cursor, textAlign, title, titleProps],
  );
  const tooltipContent = useMemo(
    () => <SizableText size="$bodySm">{titleTooltip}</SizableText>,
    [titleTooltip],
  );

  let titleContent;
  if (renderTitle) {
    titleContent = renderTitle(renderInlineSortIcon());
  } else if (typeof title === 'string') {
    const titleText = (
      <SizableText
        color="$textSubdued"
        size="$bodySmMedium"
        textAlign={textAlign}
        {...titleProps}
      >
        {title}
      </SizableText>
    );
    titleContent = titleTooltip ? (
      <Tooltip
        placement="top"
        // The trigger consumes the press, so it performs the sort itself
        // rather than leaving the click to bubble to the column.
        onPress={handleColumnPress}
        renderTrigger={tooltipTrigger}
        renderContent={tooltipContent}
      />
    ) : (
      titleText
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
