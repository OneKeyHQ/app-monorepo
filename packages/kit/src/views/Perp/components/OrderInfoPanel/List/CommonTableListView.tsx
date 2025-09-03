import type { ReactNode } from 'react';

import {
  ScrollView,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';

export interface IColumnConfig {
  key: string;
  title: string;
  width?: number; // 固定宽度
  minWidth?: number; // 最小宽度（可变宽度）
  align?: 'left' | 'center' | 'right';
}

export interface ICommonTableListViewProps {
  columns: IColumnConfig[];
  data: any[];
  renderRow: (item: any, index: number) => ReactNode;
  emptyMessage?: string;
  emptySubMessage?: string;
  minTableWidth?: number;
  headerBgColor?: string;
  headerTextColor?: string;
  borderColor?: string;
  rowHoverColor?: string;
}

export function CommonTableListView({
  columns,
  data,
  renderRow,
  emptyMessage = 'No data',
  emptySubMessage = 'Data will appear here',
  minTableWidth,
  headerBgColor = '$bgSubtle',
  headerTextColor = '$textSubdued',
  borderColor = '$borderSubdued',
  rowHoverColor = '$bgHover',
}: ICommonTableListViewProps) {
  // 计算总的最小宽度
  const totalMinWidth = columns.reduce(
    (sum, col) => sum + (col.width || col.minWidth || 0),
    0,
  );

  // 确定表格的最终宽度
  const finalTableWidth = minTableWidth || totalMinWidth;

  const getJustifyContent = (align?: string) => {
    if (align === 'center') return 'center';
    if (align === 'right') return 'flex-end';
    return 'flex-start';
  };

  return (
    <YStack flex={1} overflow="hidden">
      <Tabs.ScrollView
        style={{
          flex: 1,
        }}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{
          minWidth: finalTableWidth,
          flexGrow: 1,
          width: '100%',
        }}
      >
        {data.length ? (
          <YStack flex={1} minWidth={finalTableWidth} width="100%">
            <XStack
              py="$2"
              px="$3"
              minWidth={finalTableWidth}
              width="100%"
              borderBottomWidth="$px"
              borderBottomColor={borderColor}
              bg={headerBgColor}
            >
              {columns.map((column) => {
                const isFixedWidth = !!column.width;

                return (
                  <XStack
                    key={column.key}
                    width={isFixedWidth ? column.width : undefined}
                    minWidth={isFixedWidth ? undefined : column.minWidth}
                    flex={isFixedWidth ? undefined : 1}
                    justifyContent={getJustifyContent(column.align) as any}
                  >
                    <SizableText
                      size="$bodySm"
                      color={headerTextColor}
                      fontWeight="600"
                      textAlign={column.align || 'left'}
                    >
                      {column.title}
                    </SizableText>
                  </XStack>
                );
              })}
            </XStack>

            {data.map((item, index) => (
              <XStack key={index}>{renderRow(item, index)}</XStack>
            ))}
          </YStack>
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {emptyMessage}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              textAlign="center"
              mt="$2"
            >
              {emptySubMessage}
            </SizableText>
          </YStack>
        )}
      </Tabs.ScrollView>
    </YStack>
  );
}
