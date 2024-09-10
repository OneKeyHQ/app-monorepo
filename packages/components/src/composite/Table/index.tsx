import type { PropsWithChildren, ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import { useMedia, withStaticProperties } from 'tamagui';

import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { IconButton } from '../../actions/IconButton';
import { ListView } from '../../layouts/ListView';
import { Icon, SizableText, Stack, XStack, YStack } from '../../primitives';

import type { IListViewProps, IListViewRef } from '../../layouts';
import type { ISizableTextProps, IStackProps } from '../../primitives';
import type {
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

function Column<T>({
  children,
  width,
  showSortIcon,
  order,
  onPress,
  cursor,
  name,
  align = 'left',
  ...props
}: PropsWithChildren<
  {
    name: string;
    showSortIcon?: boolean;
    order?: 'asc' | 'desc' | undefined;
    align?: ITableColumn<T>['align'];
    onPress?: () => void;
  } & Omit<IStackProps, 'onPress'>
>) {
  const jc = useMemo(() => {
    if (align === 'left') {
      return 'flex-start';
    }
    if (align === 'right') {
      return 'flex-end';
    }
    return 'center';
  }, [align]);

  const renderSortIcon = useCallback(() => {
    if (showSortIcon && order) {
      return (
        <Icon
          cursor={cursor}
          name={
            order === 'desc'
              ? 'ChevronDownSmallOutline'
              : 'ChevronTopSmallOutline'
          }
          color="$iconSubdued"
          size="$4"
        />
      );
    }
    return null;
  }, [cursor, order, showSortIcon]);
  return (
    <XStack
      key={name}
      testID={`list-column-${name}`}
      jc={jc}
      ai="center"
      alignItems="center"
      width={width}
      onPress={onPress}
      cursor={cursor}
      userSelect="none"
      {...props}
    >
      {jc === 'flex-end' ? renderSortIcon() : null}
      {typeof children === 'string' ? (
        <SizableText color="$textSubdued" size="$bodySmMedium">
          {children}
        </SizableText>
      ) : (
        children
      )}
      {jc === 'flex-start' ? renderSortIcon() : null}
    </XStack>
  );
}

const renderContent = (text?: string) => (
  <SizableText size="$bodyMd" color="$textSubdued" userSelect="none">
    {text ?? '-'}
  </SizableText>
);

export interface ITableColumn<T> {
  title: string;
  dataIndex: string;
  titleProps?: ISizableTextProps;
  columnProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  columnWidth?: IStackProps['width'];
  renderSkeleton?: () => ReactElement;
  render?: (text: any, record: T, index: number) => ReactElement;
  // The specify which way that column is aligned. default value is left
  align?: 'left' | 'right' | 'center';
}

function TableRow<T>({
  item,
  index,
  columns,
  onRow,
  rowProps,
  pressStyle = false,
  showSkeleton = false,
}: {
  pressStyle?: boolean;
  item: T;
  index: number;
  columns: ITableProps<T>['columns'];
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
  showSkeleton?: boolean;
  onRow?: ITableProps<T>['onRow'];
  rowProps?: ITableProps<T>['rowProps'];
}) {
  const onRowEvents = useMemo(() => onRow?.(item, index), [index, item, onRow]);
  const handlePress = useCallback(() => {
    onRowEvents?.onPress?.();
  }, [onRowEvents]);
  const itemPressStyle = pressStyle ? listItemPressStyle : undefined;
  return (
    <XStack
      minHeight={60}
      onPress={handlePress}
      borderRadius="$3"
      {...itemPressStyle}
      {...rowProps}
    >
      {columns.map((column) => {
        if (!column) {
          return null;
        }
        const {
          dataIndex,
          align,
          render = renderContent,
          renderSkeleton,
          columnWidth = 40,
          columnProps,
        } = column;
        return (
          <Column
            key={dataIndex}
            name={dataIndex}
            align={align}
            width={columnWidth}
            {...columnProps}
          >
            {showSkeleton
              ? renderSkeleton?.()
              : render(
                  (item as Record<string, string>)[
                    dataIndex
                  ] as unknown as string,
                  item,
                  index,
                )}
          </Column>
        );
      })}
    </XStack>
  );
}

function TableSkeletonRow<T = any>({
  columns,
  index,
  rowProps,
}: {
  columns: ITableProps<T>['columns'];
  index: number;
  rowProps?: ITableProps<T>['rowProps'];
}) {
  return (
    <TableRow
      columns={columns}
      showSkeleton
      rowProps={rowProps}
      item={undefined as any}
      key={index}
      index={index}
    />
  );
}
export interface ITableProps<T> {
  showHeader?: boolean;
  showBackToTopButton?: boolean;
  dataSource: T[];
  columns: ITableColumn<T>[];
  renderScrollComponent?: IListViewProps<T>['renderScrollComponent'];
  TableHeaderComponent?: IListViewProps<T>['ListHeaderComponent'];
  TableFooterComponent?: IListViewProps<T>['ListFooterComponent'];
  TableEmptyComponent?: IListViewProps<T>['ListEmptyComponent'];
  extraData?: IListViewProps<T>['extraData'];
  stickyHeader?: boolean;
  stickyHeaderHiddenOnScroll?: IListViewProps<T>['stickyHeaderHiddenOnScroll'];
  estimatedListSize?: { width: number; height: number };
  estimatedItemSize?: IListViewProps<T>['estimatedItemSize'];
  rowProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  headerRowProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  onHeaderRow?: (
    column: ITableColumn<T>,
    index: number,
  ) =>
    | {
        onPress?: () => void;
        onSortTypeChange?: (sortOrder: 'asc' | 'desc' | undefined) => void;
      }
    | undefined;
  onRow?: (
    record: T,
    index: number,
  ) =>
    | {
        onPress?: () => void;
      }
    | undefined;
}

function HeaderColumn<T>({
  column,
  index,
  onHeaderRow,
  selectedColumnName,
  onChangeSelectedName,
}: {
  column: ITableColumn<T>;
  index: number;
  selectedColumnName: string;
  onChangeSelectedName: (columnName: string) => void;
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
}) {
  const {
    title,
    dataIndex,
    columnWidth = 40,
    align,
    columnProps,
    titleProps,
  } = column;
  const events = onHeaderRow?.(column, index);
  const enableSortType = !!events?.onSortTypeChange;
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>();

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
    setTimeout(() => {
      onChangeSelectedName(dataIndex);
    });
    let order: 'asc' | 'desc' | undefined = 'desc';
    if (sortOrder === 'desc') {
      order = 'asc';
    } else if (sortOrder === 'asc') {
      order = undefined;
    }
    setSortOrder(order);
    setTimeout(() => {
      events?.onSortTypeChange?.(order);
    });
  }, [dataIndex, enableSortType, events, onChangeSelectedName, sortOrder]);
  const cursor = enableSortType ? 'pointer' : undefined;
  const showSortIcon = enableSortType && dataIndex === selectedColumnName;

  const textAlign = useMemo(() => {
    if (align === 'right') {
      return 'right';
    }
    return undefined;
  }, [align]);

  return (
    <Column
      align={align}
      showSortIcon={showSortIcon}
      key={dataIndex}
      name={dataIndex}
      width={columnWidth}
      order={sortOrder}
      onPress={handleColumnPress}
      cursor={cursor}
      {...columnProps}
    >
      <SizableText
        color="$textSubdued"
        size="$bodySmMedium"
        textAlign={textAlign}
        {...titleProps}
      >
        {title}
      </SizableText>
    </Column>
  );
}

const MemoHeaderColumn = memo(HeaderColumn);

function TableHeaderRow<T>({
  columns,
  onHeaderRow,
  rowProps,
  headerRowProps,
}: {
  columns: ITableProps<T>['columns'];
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
  rowProps?: ITableProps<T>['rowProps'];
  headerRowProps?: ITableProps<T>['headerRowProps'];
}) {
  const [selectedColumnName, setSelectedColumnName] = useState('');
  return (
    <XStack {...rowProps} {...headerRowProps}>
      {columns.map((column, index) =>
        column ? (
          <MemoHeaderColumn
            key={column.dataIndex}
            selectedColumnName={selectedColumnName}
            onChangeSelectedName={setSelectedColumnName}
            column={column as any}
            index={index}
            onHeaderRow={onHeaderRow}
          />
        ) : null,
      )}
    </XStack>
  );
}

function BasicTable<T>({
  dataSource,
  columns,
  extraData,
  TableHeaderComponent,
  TableFooterComponent,
  TableEmptyComponent,
  onHeaderRow,
  onRow,
  rowProps,
  headerRowProps,
  renderScrollComponent,
  showHeader = true,
  estimatedItemSize = 60,
  estimatedListSize = { width: 370, height: 525 },
  stickyHeader = true,
  stickyHeaderHiddenOnScroll = false,
  showBackToTopButton = false,
}: ITableProps<T>) {
  const { gtMd } = useMedia();
  const [isShowBackToTopButton, setIsShowBackToTopButton] = useState(false);
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const isShowBackToTopButtonRef = useRef(isShowBackToTopButton);
  isShowBackToTopButtonRef.current = isShowBackToTopButton;
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const isShow = event.nativeEvent.contentOffset.y > 0;
      if (isShowBackToTopButtonRef.current !== isShow) {
        setIsShowBackToTopButton(isShow);
      }
    },
    [],
  );

  const handleScrollToTop = useCallback(() => {
    if (listViewRef.current) {
      listViewRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const handleRenderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => (
      <TableRow
        pressStyle
        item={item}
        index={index}
        columns={columns}
        onRow={onRow}
        rowProps={rowProps}
      />
    ),
    [columns, onRow, rowProps],
  );

  const enableBackToTopButton = showBackToTopButton && isShowBackToTopButton;

  const headerRow = useMemo(
    () =>
      showHeader ? (
        <TableHeaderRow
          columns={columns}
          rowProps={rowProps}
          headerRowProps={headerRowProps}
          onHeaderRow={onHeaderRow}
        />
      ) : null,
    [columns, headerRowProps, onHeaderRow, rowProps, showHeader],
  );
  const list = useMemo(
    () => (
      <ListView
        ref={listViewRef}
        stickyHeaderHiddenOnScroll={stickyHeaderHiddenOnScroll}
        estimatedItemSize={estimatedItemSize}
        // @ts-ignore
        estimatedListSize={estimatedListSize}
        onScroll={showBackToTopButton ? handleScroll : undefined}
        scrollEventThrottle={100}
        data={dataSource}
        renderItem={handleRenderItem}
        ListHeaderComponent={
          <>
            {TableHeaderComponent}
            {stickyHeader ? null : headerRow}
          </>
        }
        ListFooterComponent={TableFooterComponent}
        ListEmptyComponent={TableEmptyComponent}
        extraData={extraData}
        renderScrollComponent={renderScrollComponent}
      />
    ),
    [
      TableEmptyComponent,
      TableFooterComponent,
      TableHeaderComponent,
      dataSource,
      estimatedItemSize,
      estimatedListSize,
      extraData,
      handleRenderItem,
      handleScroll,
      headerRow,
      renderScrollComponent,
      showBackToTopButton,
      stickyHeader,
      stickyHeaderHiddenOnScroll,
    ],
  );

  return stickyHeader ? (
    <YStack flex={1}>
      {headerRow}
      {list}
      {enableBackToTopButton ? (
        <Stack
          position="absolute"
          bg="$bg"
          borderRadius="$full"
          bottom={gtMd ? '$8' : '$4'}
          right={gtMd ? '$8' : '$4'}
        >
          <IconButton
            title=""
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$transparent"
            iconColor="$icon"
            icon="AlignTopOutline"
            onPress={handleScrollToTop}
          />
        </Stack>
      ) : null}
    </YStack>
  ) : (
    list
  );
}

function TableSkeleton<T>({
  count,
  columns,
  rowProps,
}: {
  count: number;
  columns: ITableProps<T>['columns'];
  rowProps?: ITableProps<T>['rowProps'];
}) {
  return (
    <YStack>
      {new Array(count).fill(0).map((i) => (
        <TableSkeletonRow
          index={i}
          columns={columns}
          key={i}
          rowProps={rowProps}
        />
      ))}
    </YStack>
  );
}

export const Table = withStaticProperties(BasicTable, {
  Row: TableRow,
  Skeleton: TableSkeleton,
  SkeletonRow: TableSkeletonRow,
});
