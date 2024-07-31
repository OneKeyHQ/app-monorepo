import type { PropsWithChildren, ReactElement } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import { useMedia } from 'tamagui';

import { IconButton } from '../../actions/IconButton';
import { ListView } from '../../layouts/ListView';
import { Icon, SizableText, Stack, XStack, YStack } from '../../primitives';

import type { IListViewProps, IListViewRef } from '../../layouts';
import type { IStackProps } from '../../primitives';
import type {
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const listItemPressStyle = {
  hoverStyle: { bg: '$bgHover' },
  pressStyle: { bg: '$bgActive' },
  focusable: true,
  focusStyle: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: '$focusRing',
    outlineOffset: -2,
  },
};

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
    if (showSortIcon) {
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
      {...props}
    >
      {jc === 'flex-end' ? renderSortIcon() : null}
      {typeof children === 'string' ? (
        <SizableText cursor={cursor} color="$textSubdued" size="$bodySmMedium">
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
  <SizableText size="$bodyMd" color="$textSubdued" selectable={false}>
    {text ?? '-'}
  </SizableText>
);

interface ITableColumn<T> {
  title: string;
  dataIndex: string;
  columnProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  columnWidth?: IStackProps['width'];
  render?: (text: any, record: T, index: number) => ReactElement;
  // The specify which way that column is aligned. default value is left
  align?: 'left' | 'right' | 'center';
}

function TableRow<T>({
  item,
  index,
  columns,
  onRow,
}: {
  item: T;
  index: number;
  columns: ITableProps<T>['columns'];
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
  onRow?: ITableProps<T>['onRow'];
}) {
  const onRowEvents = useMemo(() => onRow?.(item, index), [index, item, onRow]);
  const handlePress = useCallback(() => {
    onRowEvents?.onPress?.();
  }, [onRowEvents]);
  return (
    <XStack
      space="$3"
      px="$3"
      mx="$2"
      minHeight={60}
      onPress={handlePress}
      borderRadius="$3"
      {...listItemPressStyle}
    >
      {columns.map(
        ({
          dataIndex,
          align,
          render = renderContent,
          columnWidth = 40,
          columnProps,
        }) => (
          <Column
            key={dataIndex}
            name={dataIndex}
            align={align}
            width={columnWidth}
            {...columnProps}
          >
            {render(
              (item as Record<string, string>)[dataIndex] as unknown as string,
              item,
              index,
            )}
          </Column>
        ),
      )}
    </XStack>
  );
}

export interface ITableProps<T> {
  showHeader?: boolean;
  showBackToTopButton?: boolean;
  dataSource: T[];
  columns: ITableColumn<T>[];
  TableFooterComponent: IListViewProps<T>['ListFooterComponent'];
  TableEmptyComponent: IListViewProps<T>['ListEmptyComponent'];
  extraData: IListViewProps<T>['extraData'];
  stickyHeaderHiddenOnScroll: IListViewProps<T>['stickyHeaderHiddenOnScroll'];
  estimatedListSize?: { width: number; height: number };
  estimatedItemSize?: IListViewProps<T>['estimatedItemSize'];
  onHeaderRow?: (
    columns: ITableColumn<T>,
    index: number,
  ) => {
    onPress?: () => void;
    onSortTypeChange?: (sortOrder: 'asc' | 'desc' | undefined) => void;
  };
  onRow?: (
    record: T,
    index: number,
  ) => {
    onPress?: () => void;
  };
}

function HeaderColumn<T>({
  column,
  index,
  onHeaderRow,
}: {
  column: ITableColumn<T>;
  index: number;
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
}) {
  const { title, dataIndex, columnWidth = 40, align, columnProps } = column;
  const events = onHeaderRow?.(column, index);
  const useSortFunc = !!events?.onSortTypeChange;
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>();
  const handleColumnPress = useCallback(() => {
    setTimeout(() => {
      events?.onPress?.();
    });
    if (!useSortFunc) {
      return;
    }
    let order: 'asc' | 'desc' | undefined = 'desc';
    if (sortOrder === 'desc') {
      order = 'asc';
    } else if (sortOrder === 'asc') {
      order = undefined;
    }
    setSortOrder(order);
    setTimeout(() => {
      events?.onSortTypeChange?.(sortOrder);
    });
  }, [events, sortOrder, useSortFunc]);
  const cursor = useSortFunc ? 'pointer' : undefined;
  return (
    <Column
      align={align}
      showSortIcon={useSortFunc}
      key={dataIndex}
      name={dataIndex}
      width={columnWidth}
      order={sortOrder}
      onPress={handleColumnPress}
      cursor={cursor}
      {...columnProps}
    >
      <SizableText color="$textSubdued" size="$bodySmMedium">
        {title}
      </SizableText>
    </Column>
  );
}

const MemoHeaderColumn = memo(HeaderColumn);

function TableHeaderRow<T>({
  columns,
  onHeaderRow,
}: {
  columns: ITableProps<T>['columns'];
  onHeaderRow?: ITableProps<T>['onHeaderRow'];
}) {
  return (
    <XStack space="$3" px="$3" mx="$2" minHeight="$4" py="$2" borderRadius="$3">
      {columns.map((column, index) => (
        <MemoHeaderColumn
          key={column.dataIndex}
          column={column as any}
          index={index}
          onHeaderRow={onHeaderRow}
        />
      ))}
    </XStack>
  );
}

export function Table<T>({
  dataSource,
  columns,
  extraData,
  TableFooterComponent,
  TableEmptyComponent,
  onHeaderRow,
  onRow,
  showHeader = true,
  estimatedItemSize = 60,
  estimatedListSize = { width: 370, height: 525 },
  stickyHeaderHiddenOnScroll = false,
  showBackToTopButton = false,
}: ITableProps<T>) {
  const { gtMd } = useMedia();
  const [isShowBackToTopButton, setIsShowBackToTopButton] =
    useState(showBackToTopButton);
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      setIsShowBackToTopButton(event.nativeEvent.contentOffset.y > 0),
    [],
  );

  const handleScrollToTop = useCallback(() => {
    if (listViewRef.current) {
      listViewRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const handleRenderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => (
      <TableRow item={item} index={index} columns={columns} onRow={onRow} />
    ),
    [columns, onRow],
  );

  return (
    <YStack flex={1}>
      {showHeader ? (
        <TableHeaderRow columns={columns} onHeaderRow={onHeaderRow} />
      ) : null}
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
        ListFooterComponent={TableFooterComponent}
        ListEmptyComponent={TableEmptyComponent}
        extraData={extraData}
      />
      {isShowBackToTopButton ? (
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
  );
}
