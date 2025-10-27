import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import { globalRef } from 'react-native-draggable-flatlist/src/context/globalRef';

import {
  getTokenValue,
  useMedia,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { IconButton } from '../../actions/IconButton';
import { ListView } from '../../layouts/ListView';
import { SortableListView } from '../../layouts/SortableListView';
import { SizableText, Stack, XStack, YStack } from '../../primitives';
import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import { Column, MemoHeaderColumn } from './components';

import type { ITableProps } from './types';
import type { IListViewRef } from '../../layouts';
import type { IRenderItemParams } from '../../layouts/SortableListView';
import type { IXStackProps } from '../../primitives';
import type {
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const DEFAULT_ROW_HEIGHT = 60;

const renderContent = (text?: string) => (
  <SizableText size="$bodyMd" color="$textSubdued" userSelect="none">
    {text ?? '-'}
  </SizableText>
);

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

// Export types
export type { ITableProps, ITableColumn } from './types';
export { ETableSortType } from './types';
