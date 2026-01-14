import { Skeleton, Stack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';

type IBorrowListSkeletonProps<T> = {
  columns: ITableColumn<T>[];
  rowGap?: string;
  itemCount?: number;
  /** Match empty state height when no data */
  matchEmptyHeight?: boolean;
};

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

function getColumnFlexStyle<T>(column: ITableColumn<T>) {
  const style: Record<string, any> = {
    ai: column.align ?? 'flex-start',
  };

  const flexValue = column.flex ?? 1;
  if (typeof flexValue === 'number') {
    style.flexGrow = flexValue;
    style.flexShrink = 1;
    style.flexBasis = 0;
  } else {
    Object.assign(style, parseFlexShorthand(flexValue));
  }

  if (column.minWidth !== undefined) {
    style.minWidth = column.minWidth;
  }
  if (column.maxWidth !== undefined) {
    style.maxWidth = column.maxWidth;
  }

  return style;
}

/** Skeleton that matches Empty component height (p="$5" + title height) */
export const EmptyStateSkeleton = () => (
  <YStack p="$5" ai="center" jc="center">
    <Skeleton w={160} h="$5" borderRadius="$2" />
  </YStack>
);

export const BorrowListSkeleton = <T,>({
  columns,
  rowGap,
  itemCount = 3,
  matchEmptyHeight = false,
}: IBorrowListSkeletonProps<T>) => {
  // When matching empty height, show a single centered skeleton
  if (matchEmptyHeight) {
    return <EmptyStateSkeleton />;
  }

  return (
    <YStack gap="$2">
      <ListItem gap={rowGap ?? '$3'}>
        {columns.map((column, columnIndex) => (
          <Stack key={column.key} {...getColumnFlexStyle(column)}>
            <Skeleton
              w={columnIndex === 0 ? 120 : 80}
              h="$3"
              borderRadius="$2"
            />
          </Stack>
        ))}
      </ListItem>
      {Array.from({ length: itemCount }).map((_, rowIndex) => (
        <ListItem key={rowIndex} gap={rowGap ?? '$3'}>
          {columns.map((column, columnIndex) => (
            <Stack key={column.key} {...getColumnFlexStyle(column)}>
              <YStack gap="$1">
                <Skeleton
                  w={columnIndex === 0 ? 140 : 90}
                  h="$4"
                  borderRadius="$2"
                />
                <Skeleton
                  w={columnIndex === 0 ? 100 : 60}
                  h="$3"
                  borderRadius="$2"
                />
              </YStack>
            </Stack>
          ))}
        </ListItem>
      ))}
    </YStack>
  );
};
