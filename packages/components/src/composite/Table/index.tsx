import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Pressable, StyleSheet } from 'react-native';
import { globalRef } from 'react-native-draggable-flatlist/src/context/globalRef';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  getTokenValue,
  useThemeName,
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
  const themeName = useThemeName();
  const isDarkMode = themeName?.includes('dark');
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

  const handleContextMenu = useCallback(
    (e: { preventDefault: () => void; clientX?: number; clientY?: number }) => {
      if (onRowEvents?.onContextMenu) {
        e.preventDefault();
        onRowEvents.onContextMenu(
          e.clientX !== null &&
            e.clientX !== undefined &&
            e.clientY !== null &&
            e.clientY !== undefined
            ? { x: e.clientX, y: e.clientY }
            : undefined,
        );
      }
    },
    [onRowEvents],
  );

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

  // On native, use Pressable for scroll-vs-tap disambiguation (same as ListItem).
  const useNativePressable =
    platformEnv.isNative && !!onRowEvents?.onPress && !showSkeleton;

  // Track native press state for visual feedback (bg='$bgActive').
  const [nativePressed, setNativePressed] = useState(false);
  const handleNativePressIn = useCallback(() => setNativePressed(true), []);
  const handleNativePressOut = useCallback(() => setNativePressed(false), []);

  const content = (
    <XStack
      minHeight={DEFAULT_ROW_HEIGHT}
      bg="$bgApp"
      borderRadius="$3"
      dataSet={!platformEnv.isNative && draggable ? dataSet : undefined}
      onPressIn={!platformEnv.isNative ? handlePressIn : undefined}
      onPress={!useNativePressable ? handlePress : undefined}
      onLongPress={!useNativePressable && md ? handleLongPress : undefined}
      {...(!platformEnv.isNative && {
        onContextMenu: handleContextMenu as any,
      })}
      {...(!platformEnv.isNative &&
        draggable && {
          cursor: isDragging ? 'grabbing' : 'grab',
        })}
      {...nativeScaleAnimationProps}
      {...(!useNativePressable ? (itemPressStyle as IXStackProps) : undefined)}
      {...(rowProps as IXStackProps)}
      {...(nativePressed || (isDragging && isDarkMode)
        ? { bg: '$bgActive' }
        : undefined)}
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

  if (useNativePressable) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={md ? handleLongPress : undefined}
        onPressIn={handleNativePressIn}
        onPressOut={handleNativePressOut}
        unstable_pressDelay={50}
      >
        {content}
      </Pressable>
    );
  }

  return content;
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
  const initialSelectedColumn = useMemo(() => {
    if (!onHeaderRow) return '';
    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      if (col) {
        const ev = onHeaderRow(col, i);
        if (ev?.initialSortOrder) {
          return col.dataIndex;
        }
      }
    }
    return '';
  }, [columns, onHeaderRow]);
  const [selectedColumnName, setSelectedColumnName] = useState(
    initialSelectedColumn,
  );
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
  tabIntegrated,
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
    ({ item, drag, dragProps, index, isActive }: IRenderItemParams<T>) => {
      const row = (
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
      );
      if (platformEnv.isNative) {
        return (
          <SortableListView.ShadowDecorator>
            {row}
          </SortableListView.ShadowDecorator>
        );
      }
      return row;
    },
    [columns, draggable, onRow, rowProps, showSkeleton],
  );
  // On native, when tabIntegrated the header row MUST be inside the list
  // (as ListHeaderComponent) so it participates in the collapsible tab scroll.
  // On web, the header must stay outside the list because SortableListView uses
  // absolute positioning for items, which would overlap ListHeaderComponent.
  const effectiveStickyHeader =
    stickyHeader && (!tabIntegrated || !platformEnv.isNative);

  const list = useMemo(
    () =>
      draggable ? (
        <SortableListView
          enabled
          tabIntegrated={tabIntegrated}
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
              {effectiveStickyHeader ? null : headerRow}
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
              {effectiveStickyHeader ? null : headerRow}
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
      effectiveStickyHeader,
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
      tabIntegrated,
    ],
  );

  return effectiveStickyHeader ? (
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
  HeaderRow: TableHeaderRow,
  Skeleton: TableSkeleton,
  SkeletonRow: TableSkeletonRow,
});

// Export types
export type { ITableProps, ITableColumn } from './types';
export { ETableSortType } from './types';
