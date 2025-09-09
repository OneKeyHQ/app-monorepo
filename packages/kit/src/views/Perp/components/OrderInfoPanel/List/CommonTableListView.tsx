import type { ReactElement } from 'react';

import {
  ListView,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { calcCellAlign, getColumnStyle } from '../utils';

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

  return (
    <YStack flex={1}>
      <ScrollView
        style={{
          flex: 1,
        }}
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        contentContainerStyle={{
          minWidth: minTableWidth,
          flexGrow: 1,
        }}
      >
        {data.length ? (
          <YStack flex={1} minWidth={minTableWidth} width="100%">
            <XStack
              py="$2"
              px="$3"
              display="flex"
              minWidth={minTableWidth}
              width="100%"
              borderBottomWidth="$px"
              borderBottomColor={borderColor}
              bg={headerBgColor}
            >
              {columns.map((column, index) => {
                return (
                  <XStack
                    key={column.key}
                    {...getColumnStyle(column)}
                    justifyContent={calcCellAlign(column.align) as any}
                    {...(index === 0 && {
                      pl: '$2',
                    })}
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

            {data.map((item, index) => renderRow(item, index))}
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
      </ScrollView>
    </YStack>
  );
}
