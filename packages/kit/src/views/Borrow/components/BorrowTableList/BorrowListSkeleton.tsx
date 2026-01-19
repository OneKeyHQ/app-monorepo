import { Empty, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';

type IBorrowListSkeletonProps<T> = {
  columns: ITableColumn<T>[];
  rowGap?: string;
  itemCount?: number;
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

const BorrowListEmptyRowSkeleton = <T,>({
  columns,
  rowGap,
}: {
  columns: ITableColumn<T>[];
  rowGap?: string;
}) => (
  <XStack gap={rowGap ?? '$3'} px="$3" py="$2" ai="center" width="100%">
    {columns.map((column, columnIndex) => (
      <Stack key={column.key} {...getColumnFlexStyle(column)}>
        {columnIndex === 0 ? (
          <XStack alignItems="center" gap="$2">
            <Skeleton w="$6" h="$6" borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton w={120} h="$3" borderRadius="$2" />
              <Skeleton w={80} h="$2" borderRadius="$2" />
            </YStack>
          </XStack>
        ) : (
          <YStack gap="$1">
            <Skeleton w={70} h="$3" borderRadius="$2" />
            <Skeleton w={50} h="$2" borderRadius="$2" />
          </YStack>
        )}
      </Stack>
    ))}
  </XStack>
);

/** Skeleton aligned to Empty height while keeping list-row layout */
export const EmptyStateSkeleton = <T,>({
  columns,
  rowGap,
  emptyContent,
}: {
  columns: ITableColumn<T>[];
  rowGap?: string;
  emptyContent: string;
}) => (
  <Stack position="relative" overflow="hidden">
    <Empty
      title={emptyContent}
      titleProps={{ size: '$bodyMd', color: 'transparent' }}
    />
    <Stack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      ai="center"
      jc="center"
      pointerEvents="none"
    >
      <BorrowListEmptyRowSkeleton columns={columns} rowGap={rowGap} />
    </Stack>
  </Stack>
);

export const BorrowListSkeleton = <T,>({
  columns,
  rowGap,
  itemCount = 3,
}: IBorrowListSkeletonProps<T>) => {
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
              {columnIndex === 0 ? (
                <XStack alignItems="center" gap="$3">
                  <Skeleton w="$8" h="$8" borderRadius="$full" />
                  <YStack gap="$1">
                    <Skeleton w={140} h="$4" borderRadius="$2" />
                    <Skeleton w={100} h="$3" borderRadius="$2" />
                  </YStack>
                </XStack>
              ) : (
                <YStack gap="$1">
                  <Skeleton w={90} h="$4" borderRadius="$2" />
                  <Skeleton w={60} h="$3" borderRadius="$2" />
                </YStack>
              )}
            </Stack>
          ))}
        </ListItem>
      ))}
    </YStack>
  );
};
