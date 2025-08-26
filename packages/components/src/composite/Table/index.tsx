import type { PropsWithChildren, ReactElement, RefObject } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import { globalRef } from 'react-native-draggable-flatlist/src/context/globalRef';
import { getTokenValue, useMedia, withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { IconButton } from '../../actions/IconButton';
import { ListView } from '../../layouts/ListView';
import { SortableListView } from '../../layouts/SortableListView';
import { Icon, SizableText, Stack, XStack, YStack } from '../../primitives';
import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import type { IListViewProps, IListViewRef } from '../../layouts';
import type {
  IRenderItemParams,
  ISortableListViewProps,
} from '../../layouts/SortableListView';
import type {
  ISizableTextProps,
  IStackProps,
  IXStackProps,
} from '../../primitives';
import type {
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const DEFAULT_ROW_HEIGHT = 60;

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
  } & Omit<IXStackProps, 'onPress'>
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
    if (showSortIcon) {
      if (order) {
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
      return (
        <Icon
          cursor={cursor}
          name="ChevronGrabberVerOutline"
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
  columns,
  dataSet,
  drag,
  index,
  item,
  onRow,
  pressStyle = false,
  rowProps,
  showSkeleton = false,
  draggable = false,
  isActive = false,
  scrollAtRef,
}: {
  columns: ITableProps<T>['columns'];
  dataSet?: Record<string, any>;
  drag?: () => void;
  draggable?: boolean;
  index: number;
  item: T;
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
  onRow?: ITableProps<T>['onRow'];
  pressStyle?: boolean;
  rowProps?: ITableProps<T>['rowProps'];
  showSkeleton?: boolean;
  isActive?: boolean;
  scrollAtRef?: RefObject<number>;
}) {
  const { md } = useMedia();
  const onRowEvents = useMemo(() => onRow?.(item, index), [index, item, onRow]);
  const itemPressStyle = pressStyle ? listItemPressStyle : undefined;
  const isDragging = pressStyle && isActive;
  const pressTimeRef = useRef(0);

  const handlePressIn = useCallback(() => {
    pressTimeRef.current = Date.now();
  }, []);

  const getTimeDiff = useCallback(() => Date.now() - pressTimeRef.current, []);

  const handlePress = useCallback(() => {
    if (platformEnv.isNative) {
      onRowEvents?.onPress?.();
    } else if (getTimeDiff() < 350) {
      onRowEvents?.onPress?.();
    }
  }, [getTimeDiff, onRowEvents]);

  const handleLongPress = useCallback(() => {
    if (platformEnv.isNative) {
      if (draggable) {
        drag?.();
        setTimeout(() => {
          if (
            globalRef.translationY === 0 &&
            Date.now() - (scrollAtRef?.current || 0) > 100
          ) {
            Haptics.impact(ImpactFeedbackStyle.Medium);
            globalRef.reset();
            onRowEvents?.onLongPress?.();
          }
        }, 650);
      } else {
        onRowEvents?.onLongPress?.();
      }
    } else if (getTimeDiff() >= 350) {
      onRowEvents?.onLongPress?.();
    }
  }, [drag, draggable, getTimeDiff, scrollAtRef, onRowEvents]);

  const nativeScaleAnimationProps: IXStackProps = platformEnv.isNativeIOS
    ? {
        scale: isDragging ? 0.9 : 1,
        animateOnly: ['transform'],
        animation: 'quick',
      }
    : {};

  return (
    <XStack
      minHeight={DEFAULT_ROW_HEIGHT}
      bg={isDragging ? '$bgActive' : '$bgApp'}
      borderRadius="$3"
      dataSet={!platformEnv.isNative && draggable ? dataSet : undefined}
      onPressIn={!platformEnv.isNative ? handlePressIn : undefined}
      onPress={handlePress}
      onLongPress={md ? handleLongPress : undefined}
      {...nativeScaleAnimationProps}
      {...(itemPressStyle as IXStackProps)}
      {...(rowProps as IXStackProps)}
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
            {...(columnProps as any)}
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
  useFlashList?: boolean;
  scrollEnabled?: boolean;
  showHeader?: boolean;
  showBackToTopButton?: boolean;
  showSkeleton?: boolean;
  skeletonCount?: number;
  dataSource: T[];
  columns: ITableColumn<T>[];
  contentContainerStyle?: IListViewProps<T>['contentContainerStyle'];
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
  // Whether the column can be dragged to reorder. default value is false
  draggable?: boolean;
  onDragBegin?: ISortableListViewProps<T>['onDragBegin'];
  onDragEnd?: ISortableListViewProps<T>['onDragEnd'];
  keyExtractor: (item: T, index: number) => string;
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
        onLongPress?: () => void;
      }
    | undefined;
  // Infinite scroll support
  onEndReached?: IListViewProps<T>['onEndReached'];
  onEndReachedThreshold?: IListViewProps<T>['onEndReachedThreshold'];
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
    let order: 'asc' | 'desc' | undefined = 'desc';
    if (sortOrder === 'desc') {
      order = 'asc';
    } else if (sortOrder === 'asc') {
      order = undefined;
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
  }, [dataIndex, enableSortType, events, onChangeSelectedName, sortOrder]);
  const cursor = enableSortType ? 'pointer' : undefined;
  const showSortIcon = enableSortType;
  const currentSortOrder =
    dataIndex === selectedColumnName ? sortOrder : undefined;

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
      order={currentSortOrder}
      onPress={handleColumnPress as any}
      cursor={cursor}
      {...(columnProps as IXStackProps)}
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
    <XStack
      {...(rowProps as IXStackProps)}
      {...(headerRowProps as IXStackProps)}
    >
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
  dataSource: dataSourceOriginal,
  columns,
  extraData,
  TableHeaderComponent,
  TableFooterComponent,
  TableEmptyComponent,
  onHeaderRow,
  onRow,
  rowProps,
  keyExtractor,
  contentContainerStyle,
  headerRowProps,
  renderScrollComponent,
  onDragBegin,
  onDragEnd,
  showHeader = true,
  estimatedItemSize = DEFAULT_ROW_HEIGHT,
  estimatedListSize = { width: 370, height: 525 },
  stickyHeader = true,
  stickyHeaderHiddenOnScroll = false,
  showBackToTopButton = false,
  draggable = false,
  onEndReached,
  onEndReachedThreshold,
  scrollEnabled = true,
  useFlashList = false,
  showSkeleton = false,
  skeletonCount = 3,
}: ITableProps<T>) {
  const { gtMd } = useMedia();
  const [isShowBackToTopButton, setIsShowBackToTopButton] = useState(false);
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const isShowBackToTopButtonRef = useRef(isShowBackToTopButton);
  isShowBackToTopButtonRef.current = isShowBackToTopButton;
  const scrollAtRef = useRef(0);

  const dataSource = useMemo(() => {
    if (showSkeleton) {
      return new Array(skeletonCount).fill({} as T) as T[];
    }
    return dataSourceOriginal;
  }, [dataSourceOriginal, showSkeleton, skeletonCount]);

  const handleScrollOffsetChange = useCallback((offset: number) => {
    const isShow = offset > 0;
    if (isShowBackToTopButtonRef.current !== isShow) {
      setIsShowBackToTopButton(isShow);
    }
    scrollAtRef.current = Date.now();
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollOffsetChange(event.nativeEvent.contentOffset.y);
    },
    [handleScrollOffsetChange],
  );

  const handleScrollToTop = useCallback(() => {
    if (listViewRef.current) {
      listViewRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const handleRenderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => (
      <TableRow
        pressStyle={!showSkeleton}
        showSkeleton={showSkeleton}
        scrollAtRef={scrollAtRef}
        item={item}
        index={index}
        columns={columns}
        onRow={showSkeleton ? undefined : onRow}
        rowProps={rowProps}
      />
    ),
    [columns, onRow, rowProps, showSkeleton],
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

  const renderPlaceholder = useCallback(
    () => <XStack h={DEFAULT_ROW_HEIGHT} borderRadius="$3" />,
    [],
  );

  const handleDragBegin = useCallback(
    (index: number) => {
      Haptics.impact(ImpactFeedbackStyle.Medium);
      onDragBegin?.(index);
    },
    [onDragBegin],
  );

  const itemSize = useMemo<number | undefined>(() => {
    if (typeof estimatedItemSize === 'undefined') {
      return undefined;
    }
    return typeof estimatedItemSize === 'number'
      ? estimatedItemSize
      : (getTokenValue(estimatedItemSize, 'size') as number);
  }, [estimatedItemSize]);

  const renderSortableItem = useCallback(
    ({ item, drag, dragProps, index, isActive }: IRenderItemParams<T>) => (
      <TableRow
        pressStyle={!showSkeleton}
        isActive={isActive}
        draggable={draggable}
        dataSet={dragProps}
        showSkeleton={showSkeleton}
        drag={drag}
        scrollAtRef={scrollAtRef}
        item={item}
        index={index}
        columns={columns}
        onRow={showSkeleton ? undefined : onRow}
        rowProps={rowProps}
      />
    ),
    [columns, draggable, onRow, rowProps, showSkeleton],
  );
  const list = useMemo(
    () =>
      draggable ? (
        <SortableListView
          enabled
          useFlashList={useFlashList}
          scrollEnabled={scrollEnabled}
          ref={listViewRef as any}
          contentContainerStyle={contentContainerStyle}
          stickyHeaderHiddenOnScroll={stickyHeaderHiddenOnScroll}
          // @ts-ignore
          estimatedListSize={estimatedListSize}
          onScrollOffsetChange={handleScrollOffsetChange}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          data={dataSource}
          renderItem={renderSortableItem}
          getItemLayout={(_, index) => ({
            length: itemSize || DEFAULT_ROW_HEIGHT,
            offset: index * (itemSize || DEFAULT_ROW_HEIGHT),
            index,
          })}
          renderPlaceholder={renderPlaceholder}
          ListHeaderComponent={
            <>
              {TableHeaderComponent}
              {stickyHeader ? null : headerRow}
            </>
          }
          onDragBegin={handleDragBegin}
          onDragEnd={onDragEnd}
          keyExtractor={keyExtractor}
          ListFooterComponent={TableFooterComponent}
          ListEmptyComponent={TableEmptyComponent}
          extraData={extraData}
          renderScrollComponent={renderScrollComponent}
          onEndReached={onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
        />
      ) : (
        <ListView
          useFlashList={useFlashList}
          scrollEnabled={scrollEnabled}
          ref={listViewRef as any}
          contentContainerStyle={contentContainerStyle}
          stickyHeaderHiddenOnScroll={stickyHeaderHiddenOnScroll}
          estimatedItemSize={estimatedItemSize}
          // @ts-ignore
          estimatedListSize={estimatedListSize}
          onScroll={handleScroll}
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
          onEndReached={onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
        />
      ),
    [
      draggable,
      scrollEnabled,
      contentContainerStyle,
      stickyHeaderHiddenOnScroll,
      estimatedListSize,
      handleScrollOffsetChange,
      handleScroll,
      dataSource,
      renderSortableItem,
      renderPlaceholder,
      TableHeaderComponent,
      stickyHeader,
      headerRow,
      handleDragBegin,
      onDragEnd,
      keyExtractor,
      TableFooterComponent,
      TableEmptyComponent,
      extraData,
      renderScrollComponent,
      onEndReached,
      onEndReachedThreshold,
      useFlashList,
      estimatedItemSize,
      handleRenderItem,
      itemSize,
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
      {new Array(count).fill(0).map((_, index) => (
        <TableSkeletonRow
          index={index}
          columns={columns}
          key={index}
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
