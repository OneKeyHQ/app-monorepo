import { memo, useCallback, useMemo, useState } from 'react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  ListView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

// ==================== Types ====================

export interface ITableColumn<T> {
  key: string;
  label?: string;
  flex?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  align?: 'flex-start' | 'center' | 'flex-end';
  // Sorting
  sortable?: boolean;
  sortKey?: string;
  // Comparator function for sorting. If not provided, column is not sortable.
  // Return negative if a < b, positive if a > b, 0 if equal
  comparator?: (a: T, b: T) => number;
  // Rendering
  render: (item: T, index: number) => ReactNode;
  renderHeader?: () => ReactNode;
  // Responsive
  hideInMobile?: boolean;
}

export interface ITableListProps<T> {
  // Data
  data: T[];
  keyExtractor?: (item: T, index: number) => string;

  // Columns configuration
  columns: ITableColumn<T>[];

  // Mobile layout
  mobileRenderItem?: (item: T, index: number) => ReactElement;

  // Callbacks
  onPressRow?: (item: T, index: number) => void | Promise<void>;

  // Layout control
  tableLayout?: boolean; // Auto-detect by useMedia if not provided

  // Header
  withHeader?: boolean;

  // Sorting (optional - if not provided, component manages internally)
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  defaultSortKey?: string; // Initial sort key when using internal sorting
  defaultSortDirection?: 'asc' | 'desc'; // Initial sort direction

  // Loading state
  isLoading?: boolean;
  skeletonCount?: number;

  // Styling
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;

  // Custom components
  ListHeaderComponent?: ComponentProps<typeof ListView>['ListHeaderComponent'];
  ListFooterComponent?: ComponentProps<typeof ListView>['ListFooterComponent'];
  ListEmptyComponent?: ComponentProps<typeof ListView>['ListEmptyComponent'];
  SkeletonComponent?: ReactElement;

  // Row styling
  rowGap?: string;
  enableDrillIn?: boolean;

  // Actions column
  actions?: {
    render: (item: T, index: number) => ReactNode;
    width?: number | string; // Fixed width for actions column
    align?: 'flex-start' | 'center' | 'flex-end';
  };
}

function parseFlexShorthand(flex: string): {
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
} {
  const parts = flex.trim().split(/\s+/);

  if (parts.length === 1) {
    const value = parts[0];
    if (/^\d+$/.test(value)) {
      return { flexGrow: Number(value), flexShrink: 1, flexBasis: 0 };
    }
    return { flexBasis: value };
  }

  if (parts.length === 2) {
    const first = Number(parts[0]);
    const second = parts[1];
    if (/^\d+$/.test(second)) {
      return { flexGrow: first, flexShrink: Number(second), flexBasis: 0 };
    }
    return { flexGrow: first, flexShrink: 1, flexBasis: second };
  }

  if (parts.length === 3) {
    return {
      flexGrow: Number(parts[0]),
      flexShrink: Number(parts[1]),
      flexBasis: parts[2],
    };
  }

  return {};
}

/**
 * Get flex style properties for a column based on its configuration
 * Supports: number flex-grow, CSS flex shorthand, and min/max constraints
 */
function getColumnFlexStyle<T>(column: ITableColumn<T>) {
  const style: Record<string, any> = {
    ai: column.align ?? 'flex-start',
  };

  // Handle flex value (number or string)
  const flexValue = column.flex ?? 1;

  if (typeof flexValue === 'number') {
    // If flex is a number, treat it as flex-grow
    style.flexGrow = flexValue;
    style.flexShrink = 1;
    style.flexBasis = 0;
  } else {
    // If flex is a string, parse CSS flex shorthand
    const flexProps = parseFlexShorthand(flexValue);
    Object.assign(style, flexProps);
  }

  // Apply min/max width constraints
  if (column.minWidth !== undefined) {
    style.minWidth = column.minWidth;
  }
  if (column.maxWidth !== undefined) {
    style.maxWidth = column.maxWidth;
  }

  return style;
}

// ==================== Sort Button ====================

interface ISortButtonProps {
  label: string;
  iconName?: IKeyOfIcons;
  onPress?: IXStackProps['onPress'];
  align?: 'flex-start' | 'center' | 'flex-end';
}

const SortButton = memo(
  ({ label, iconName, onPress, align = 'flex-start' }: ISortButtonProps) => (
    <XStack
      role="button"
      ai="center"
      jc={align}
      gap="$1"
      cursor="pointer"
      hoverStyle={{ opacity: 0.7 }}
      userSelect="none"
      onPress={onPress}
    >
      {iconName ? (
        <Icon name={iconName} color="$iconSubdued" size="$4.5" />
      ) : null}
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {label}
      </SizableText>
    </XStack>
  ),
);
SortButton.displayName = 'SortButton';

// ==================== Table Header ====================

interface ITableListHeaderProps<T> {
  columns: ITableColumn<T>[];
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  rowGap?: string;
  enableDrillIn?: boolean;
  actions?: ITableListProps<T>['actions'];
}

function TableListHeader<T>({
  columns,
  sortKey,
  sortDirection,
  onSortChange,
  rowGap,
  enableDrillIn,
  actions,
}: ITableListHeaderProps<T>) {
  const handleSort = useCallback(
    (columnKey: string) => {
      if (!onSortChange) return;
      const newDirection =
        sortKey === columnKey && sortDirection === 'desc' ? 'asc' : 'desc';
      onSortChange(columnKey, newDirection);
    },
    [sortKey, sortDirection, onSortChange],
  );

  const getSortIcon = useCallback(
    (columnKey: string): IKeyOfIcons | undefined => {
      if (sortKey !== columnKey) return undefined;
      return sortDirection === 'desc'
        ? 'ChevronDownSmallOutline'
        : 'ChevronTopSmallOutline';
    },
    [sortKey, sortDirection],
  );

  return (
    <ListItem gap={rowGap ?? '$3'}>
      {columns.map((column) => {
        let content: ReactNode = null;
        if (column.renderHeader) {
          content = column.renderHeader();
        } else if (column.label) {
          if (column.sortable && onSortChange) {
            content = (
              <SortButton
                label={column.label}
                iconName={getSortIcon(column.sortKey ?? column.key)}
                onPress={() => handleSort(column.sortKey ?? column.key)}
                align={column.align ?? 'flex-start'}
              />
            );
          } else {
            content = (
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {column.label}
              </SizableText>
            );
          }
        }

        return (
          <Stack key={column.key} {...getColumnFlexStyle(column)}>
            {content}
          </Stack>
        );
      })}
      {actions ? (
        <Stack
          width={actions.width ?? 'auto'}
          flexShrink={0}
          ai={actions.align ?? 'flex-end'}
        />
      ) : null}
      {enableDrillIn ? <Stack flexGrow={1} flexBasis={0} /> : null}
    </ListItem>
  );
}

// ==================== Skeleton Loading ====================

interface ITableListSkeletonProps {
  columns: ITableColumn<any>[];
  itemCount?: number;
  rowGap?: string;
}

export const TableListSkeleton = memo(
  ({ columns, itemCount = 4, rowGap }: ITableListSkeletonProps) => {
    const media = useMedia();

    return (
      <YStack
        mx="$-5"
        $gtSm={{
          mx: 0,
          overflow: 'hidden',
          bg: '$bg',
        }}
      >
        {Array.from({ length: itemCount }).map((_, index) => (
          <ListItem
            key={index}
            gap={rowGap ?? '$3'}
            mx="$0"
            px="$4"
            {...(media.gtSm
              ? {
                  borderRadius: '$0',
                }
              : {})}
          >
            {columns
              .filter((col) => !col.hideInMobile || media.gtSm)
              .map((column, colIndex) => (
                <Stack key={column.key} {...getColumnFlexStyle(column)}>
                  <Skeleton
                    w={colIndex === 0 ? 120 : 80}
                    h={20}
                    borderRadius="$2"
                  />
                </Stack>
              ))}
          </ListItem>
        ))}
      </YStack>
    );
  },
);
TableListSkeleton.displayName = 'TableListSkeleton';

// ==================== Table Row ====================

interface ITableListRowProps<T> {
  item: T;
  index: number;
  columns: ITableColumn<T>[];
  onPress?: (item: T, index: number) => void | Promise<void>;
  rowGap?: string;
  enableDrillIn?: boolean;
  actions?: ITableListProps<T>['actions'];
}

function TableListRow<T>({
  item,
  index,
  columns,
  onPress,
  rowGap,
  enableDrillIn,
  actions,
}: ITableListRowProps<T>) {
  return (
    <ListItem
      gap={rowGap ?? '$3'}
      userSelect="none"
      onPress={onPress ? () => onPress(item, index) : undefined}
    >
      {columns.map((column) => (
        <Stack key={column.key} {...getColumnFlexStyle(column)}>
          {column.render(item, index)}
        </Stack>
      ))}
      {actions ? (
        <Stack
          width={actions.width ?? 'auto'}
          flexShrink={0}
          ai={actions.align ?? 'flex-end'}
        >
          {actions.render(item, index)}
        </Stack>
      ) : null}
      {enableDrillIn ? (
        <Stack flexGrow={1} flexBasis={0} ai="flex-end">
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </Stack>
      ) : null}
    </ListItem>
  );
}

// ==================== Main Component ====================

function BasicTableList<T>({
  data,
  keyExtractor,
  columns,
  mobileRenderItem,
  onPressRow,
  tableLayout: tableLayoutProp,
  withHeader = false,
  sortKey: sortKeyProp,
  sortDirection: sortDirectionProp,
  onSortChange,
  defaultSortKey,
  defaultSortDirection = 'desc',
  isLoading = false,
  skeletonCount = 4,
  listViewStyleProps,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  SkeletonComponent,
  rowGap,
  enableDrillIn,
  actions,
}: ITableListProps<T>) {
  const media = useMedia();

  // Internal sorting state (only used when sortKey/sortDirection not provided)
  const [internalSortKey, setInternalSortKey] = useState<string | undefined>(
    defaultSortKey,
  );
  const [internalSortDirection, setInternalSortDirection] = useState<
    'asc' | 'desc'
  >(defaultSortDirection);

  // Use external state if provided, otherwise use internal state
  const sortKey = sortKeyProp ?? internalSortKey;
  const sortDirection = sortDirectionProp ?? internalSortDirection;

  // Sort change handler
  const handleSortChange = useCallback(
    (key: string, direction: 'asc' | 'desc') => {
      if (onSortChange) {
        onSortChange(key, direction);
      } else {
        setInternalSortKey(key);
        setInternalSortDirection(direction);
      }
    },
    [onSortChange],
  );

  // Determine layout mode
  const tableLayout = useMemo(
    () => tableLayoutProp ?? media.gtSm,
    [tableLayoutProp, media.gtSm],
  );

  // Filter columns for mobile
  const visibleColumns = useMemo(
    () => (tableLayout ? columns : columns.filter((col) => !col.hideInMobile)),
    [tableLayout, columns],
  );

  // Sort data based on current sort key and direction
  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const column = columns.find((col) => (col.sortKey ?? col.key) === sortKey);
    if (!column || !column.comparator) return data;

    const sorted = [...data].sort((a, b) => {
      const result = column.comparator!(a, b);
      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }, [data, columns, sortKey, sortDirection]);

  // Build header component
  const headerComponent = useMemo(() => {
    if (ListHeaderComponent) {
      return ListHeaderComponent;
    }
    if (withHeader && tableLayout) {
      return (
        <TableListHeader
          columns={visibleColumns}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          rowGap={rowGap}
          enableDrillIn={enableDrillIn}
          actions={actions}
        />
      );
    }
    return null;
  }, [
    ListHeaderComponent,
    withHeader,
    tableLayout,
    visibleColumns,
    sortKey,
    sortDirection,
    handleSortChange,
    rowGap,
    enableDrillIn,
    actions,
  ]);

  // Render item function
  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      // Use custom mobile renderer if provided and in mobile mode
      if (!tableLayout && mobileRenderItem) {
        return mobileRenderItem(item, index);
      }

      // Default table row renderer
      return (
        <TableListRow
          item={item}
          index={index}
          columns={visibleColumns}
          onPress={onPressRow}
          rowGap={rowGap}
          enableDrillIn={enableDrillIn}
          actions={actions}
        />
      );
    },
    [
      tableLayout,
      mobileRenderItem,
      visibleColumns,
      onPressRow,
      rowGap,
      enableDrillIn,
      actions,
    ],
  );

  // Show loading skeleton
  if (isLoading && data.length === 0) {
    if (SkeletonComponent) {
      return SkeletonComponent;
    }
    return (
      <TableListSkeleton
        columns={visibleColumns}
        itemCount={skeletonCount}
        rowGap={rowGap}
      />
    );
  }

  return (
    <ListView
      data={sortedData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={headerComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      estimatedItemSize={tableLayout ? undefined : 60}
      {...listViewStyleProps}
    />
  );
}

// Export memoized version with proper typing
const MemoizedTableList = memo(BasicTableList) as typeof BasicTableList;

export const TableList = MemoizedTableList as <T>(
  props: ITableListProps<T>,
) => ReactElement;
