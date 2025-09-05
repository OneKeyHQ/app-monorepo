import type { ReactElement, ReactNode } from 'react';

import {
  ListView,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { calcCellAlign } from '../utils';

import type { ListRenderItem } from 'react-native';

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
  renderRow: (item: any, index: number) => ReactElement;
  emptyMessage?: string;
  emptySubMessage?: string;
  minTableWidth?: number;
  headerBgColor?: string;
  headerTextColor?: string;
  borderColor?: string;
  rowHoverColor?: string;
  isMobile?: boolean;
}

export function CommonTableListView({
  columns,
  data,
  renderRow,
  isMobile,
  emptyMessage = 'No data',
  emptySubMessage = 'Data will appear here',
  minTableWidth,
  headerBgColor = '$bgSubtle',
  headerTextColor = '$textSubdued',
  borderColor = '$borderSubdued',
}: ICommonTableListViewProps) {
  if (isMobile) {
    return (
      <ListView
        data={data}
        renderItem={({ item, index }) => {
          return renderRow(item, index);
        }}
      />
    );
  }
  const totalMinWidth = columns.reduce(
    (sum, col) => sum + (col.width || col.minWidth || 0),
    0,
  );
  const finalTableWidth = minTableWidth || totalMinWidth;

  return (
    <Tabs.ScrollView
      style={{
        flex: 1,
      }}
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{
        minWidth: minTableWidth,
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
  );
}
