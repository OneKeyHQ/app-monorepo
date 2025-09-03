import type { ReactNode } from 'react';

import { ScrollView, SizableText, XStack, YStack } from '@onekeyhq/components';

import { calcCellAlign } from '../utils';

export interface IColumnConfig {
  key: string;
  title: string;
  width?: number; // 固定宽度
  minWidth?: number;
  flex?: number;
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
}: ICommonTableListViewProps) {
  if (!data.length) {
    return (
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
    );
  }

  return (
    <YStack flex={1} overflow="hidden">
      <ScrollView
        flex={1}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{
          minWidth: minTableWidth,
          flexGrow: 1,
          width: '100%',
        }}
      >
        <YStack flex={1} minWidth={minTableWidth} width="100%">
          <XStack
            py="$2"
            px="$3"
            minWidth={minTableWidth}
            width="100%"
            borderBottomWidth="$px"
            borderBottomColor={borderColor}
            bg={headerBgColor}
          >
            {columns.map((column) => {
              return (
                <XStack
                  key={column.key}
                  width={column.width}
                  minWidth={column.minWidth}
                  flex={column.flex}
                  justifyContent={calcCellAlign(column.align) as any}
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
      </ScrollView>
    </YStack>
  );
}
