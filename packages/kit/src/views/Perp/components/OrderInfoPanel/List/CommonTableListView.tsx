import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import {
  IconButton,
  Input,
  ListView,
  SizableText,
  Tabs,
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
      gap="$3"
      justifyContent={isMobile ? 'center' : 'flex-end'}
      alignItems="center"
      bg={headerBgColor}
    >
      <IconButton
        variant="tertiary"
        size="small"
        disabled={currentPage === 1}
        onPress={onPreviousPage}
        icon="ChevronLeftOutline"
      />

      <Input
        value={inputValue}
        onChangeText={handleInputChange}
        onSubmitEditing={handleInputSubmit}
        onBlur={handleInputBlur}
        keyboardType="numeric"
        w="$12"
        h="$7.5"
        textAlign="center"
        size="small"
        borderColor="$borderStrong"
        borderRadius="$2"
        maxLength={3}
      />
      <SizableText size="$bodyLg" color={headerTextColor}>
        /
      </SizableText>
      <SizableText size="$bodyLg" color={headerTextColor}>
        {totalPages}
      </SizableText>
      <IconButton
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
  // 分页相关
  enablePagination?: boolean;
  pageSize?: number;
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
  enablePagination = false,
  pageSize = 20,
}: ICommonTableListViewProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedData = useMemo<any[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (!enablePagination || data.length <= pageSize) return data;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize, enablePagination]);

  const totalPages = useMemo(() => {
    if (!enablePagination || data.length <= pageSize) return 1;
    return Math.ceil(data.length / pageSize);
  }, [data.length, pageSize, enablePagination]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isMobile) {
    return (
      <YStack flex={1}>
        <ListView
          data={paginatedData}
          renderItem={({ item, index }) => {
            return renderRow(item, index);
          }}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
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
        />
        {enablePagination && totalPages > 1 ? (
          <PaginationFooter
            isMobile={isMobile}
            currentPage={currentPage}
            totalPages={totalPages}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            onPageChange={handlePageChange}
            headerBgColor={headerBgColor}
            headerTextColor={headerTextColor}
          />
        ) : null}
      </YStack>
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
        <YStack flex={1} minWidth={minTableWidth} width="100%" cursor="default">
          <ListView
            data={paginatedData}
            renderItem={({ item, index }) => {
              return renderRow(item, index);
            }}
            ListHeaderComponent={
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
            }
            ListEmptyComponent={
              <YStack
                flex={1}
                justifyContent="center"
                alignItems="center"
                p="$6"
              >
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  textAlign="center"
                >
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
          />
          {enablePagination && totalPages > 1 ? (
            <PaginationFooter
              currentPage={currentPage}
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
      </Tabs.ScrollView>
    </YStack>
  );
}
