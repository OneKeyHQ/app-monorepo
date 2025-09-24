import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import {
  IconButton,
  Input,
  ListView,
  ScrollView,
  SizableText,
  Tabs,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { calcCellAlign, getColumnStyle } from '../utils';

const PaginationFooter = ({
  currentPage,
  totalPages,
  onPreviousPage,
  isMobile,
  onNextPage,
  onPageChange,
  headerBgColor,
  headerTextColor,
}: {
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageChange: (page: number) => void;
  headerBgColor: string;
  headerTextColor: string;
  isMobile?: boolean;
}) => {
  const [inputValue, setInputValue] = useState(currentPage.toString());

  useEffect(() => {
    setInputValue(currentPage.toString());
  }, [currentPage]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const handleInputSubmit = () => {
    const page = parseInt(inputValue, 10);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setInputValue(currentPage.toString());
    }
  };

  const handleInputBlur = () => {
    setInputValue(currentPage.toString());
  };

  if (totalPages <= 1) return null;

  return (
    <XStack
      py="$3"
      px="$4"
      gap="$4"
      justifyContent={isMobile ? 'center' : 'flex-end'}
      alignItems="center"
      bg={headerBgColor}
    >
      <IconButton
        borderRadius="$full"
        borderWidth="$px"
        borderColor="$border"
        variant="tertiary"
        size="small"
        disabled={currentPage === 1}
        onPress={onPreviousPage}
        icon="ChevronLeftOutline"
      />
      <XStack gap="$2" alignItems="center">
        <XStack w={isMobile ? 40 : undefined}>
          <Input
            value={inputValue}
            onChangeText={handleInputChange}
            onSubmitEditing={handleInputSubmit}
            onBlur={handleInputBlur}
            keyboardType="numeric"
            w={isMobile ? undefined : '$12'}
            h="$7"
            p="$1"
            textAlign="center"
            borderColor="$borderStrong"
            borderRadius="$2"
            maxLength={totalPages.toString().length}
          />
        </XStack>
        <SizableText size="$bodyMd" color={headerTextColor}>
          /
        </SizableText>
        <SizableText size="$bodyMd" color={headerTextColor}>
          {totalPages}
        </SizableText>
      </XStack>
      <IconButton
        borderRadius="$full"
        borderWidth="$px"
        borderColor="$border"
        variant="tertiary"
        size="small"
        disabled={currentPage === totalPages}
        onPress={onNextPage}
        icon="ChevronRightOutline"
      />
    </XStack>
  );
};

export interface IColumnConfig {
  tooltip?: string;
  key: string;
  title: string;
  width?: number; // 固定宽度
  minWidth?: number;
  flex?: number;
  align?: 'left' | 'center' | 'right';
  onPress?: () => void;
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
  // 分页相关
  enablePagination?: boolean;
  pageSize?: number;
  currentListPage?: number;
  setCurrentListPage?: (page: number) => void;
  useTabsList?: boolean;
}

export function CommonTableListView({
  columns,
  data,
  useTabsList,
  renderRow,
  currentListPage,
  setCurrentListPage,
  isMobile,
  emptyMessage = 'No data',
  emptySubMessage = 'Data will appear here',
  minTableWidth,
  headerBgColor = '$bgSubtle',
  headerTextColor = '$textSubdued',
  borderColor = '$borderSubdued',
  enablePagination = false,
  pageSize = 20,
}: ICommonTableListViewProps) {
  const paginatedData = useMemo<any[]>(() => {
    if (!enablePagination || data.length <= pageSize || !currentListPage) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return data;
    }

    const startIndex = (currentListPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data.slice(startIndex, endIndex);
  }, [data, currentListPage, pageSize, enablePagination]);

  const totalPages = useMemo(() => {
    if (!enablePagination || data.length <= pageSize) return 1;
    return Math.ceil(data.length / pageSize);
  }, [data.length, pageSize, enablePagination]);

  const handlePreviousPage = () => {
    if (currentListPage && currentListPage > 1 && setCurrentListPage) {
      setCurrentListPage(currentListPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentListPage && currentListPage < totalPages && setCurrentListPage) {
      setCurrentListPage(currentListPage + 1);
    }
  };

  const handlePageChange = (page: number) => {
    if (setCurrentListPage) {
      setCurrentListPage(page);
    }
  };
  const ListComponent = useTabsList ? Tabs.FlatList : ListView;
  // console.log('paginatedData--', paginatedData.length);
  if (isMobile) {
    return (
      <ListComponent
        data={paginatedData}
        ListFooterComponent={
          enablePagination && currentListPage && totalPages > 1 ? (
            <PaginationFooter
              isMobile={isMobile}
              currentPage={currentListPage}
              totalPages={totalPages}
              onPreviousPage={handlePreviousPage}
              onNextPage={handleNextPage}
              onPageChange={handlePageChange}
              headerBgColor={headerBgColor}
              headerTextColor={headerTextColor}
            />
          ) : null
        }
        renderItem={({ item, index }) => {
          return renderRow(item, index);
        }}
        ListEmptyComponent={
          <YStack flex={1} alignItems="center" p="$6">
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
        }
        contentContainerStyle={{
          paddingBottom: enablePagination && totalPages > 1 ? 0 : 16,
          minHeight: 0,
        }}
      />
    );
  }

  return (
    <YStack flex={1}>
      <Tabs.ScrollView
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
          <YStack
            flex={1}
            minWidth={minTableWidth}
            width="100%"
            cursor="default"
          >
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
                    onPress={column.onPress}
                    cursor={column.onPress ? 'pointer' : 'default'}
                  >
                    {column.tooltip ? (
                      <Tooltip
                        placement="top"
                        renderTrigger={
                          <SizableText
                            size="$bodySm"
                            textDecorationLine="underline"
                            textDecorationStyle="dashed"
                            textDecorationColor="$textSubdued"
                            color={
                              column.onPress ? '$textSuccess' : headerTextColor
                            }
                            fontWeight="600"
                            textAlign={column.align || 'left'}
                          >
                            {column.title}
                          </SizableText>
                        }
                        renderContent={column.tooltip}
                      />
                    ) : (
                      <SizableText
                        size="$bodySm"
                        color={
                          column.onPress ? '$textSuccess' : headerTextColor
                        }
                        fontWeight="600"
                        textAlign={column.align || 'left'}
                      >
                        {column.title}
                      </SizableText>
                    )}
                  </XStack>
                );
              })}
            </XStack>
            <ListView
              style={{
                height: 400,
              }}
              data={paginatedData}
              renderItem={({ item, index }) => {
                return renderRow(item, index);
              }}
              ListEmptyComponent={
                <YStack
                  flex={1}
                  justifyContent="flex-start"
                  alignItems="flex-start"
                  p="$5"
                >
                  <SizableText size="$bodyMd" color="$text" textAlign="center">
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
              }
              contentContainerStyle={{
                paddingBottom: enablePagination && totalPages > 1 ? 0 : 16,
              }}
            />
            {enablePagination && currentListPage && totalPages > 1 ? (
              <PaginationFooter
                currentPage={currentListPage}
                totalPages={totalPages}
                onPreviousPage={handlePreviousPage}
                onNextPage={handleNextPage}
                onPageChange={handlePageChange}
                isMobile={isMobile}
                headerBgColor={headerBgColor}
                headerTextColor={headerTextColor}
              />
            ) : null}
          </YStack>
        </ScrollView>
      </Tabs.ScrollView>
    </YStack>
  );
}
