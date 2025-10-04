import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';
import { InputAccessoryView, Keyboard } from 'react-native';

import type {
  IDebugRenderTrackerProps,
  IInputProps,
  IXStackProps,
} from '@onekeyhq/components';
import {
  Button,
  DebugRenderTracker,
  IconButton,
  Input,
  ListView,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  Tooltip,
  XStack,
  YStack,
  useIsKeyboardShown,
} from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PullToRefresh } from '../../PullToRefresh';
import { calcCellAlign, getColumnStyle } from '../utils';

const TradesHistoryLoadingView = () => {
  return (
    <Stack
      flex={1}
      alignItems="flex-start"
      justifyContent="center"
      p="$6"
      gap="$2"
    >
      <Skeleton h="$8" w="$40" />
      <Skeleton h="$6" w="$24" />
      <Skeleton h="$4" w="$16" />
    </Stack>
  );
};

const PaginationInputAccessoryViewID = 'pagination-input-accessory-view';

const PaginationDoneOnKeyboard = ({
  inputAmount,
  totalAmount,
  onDone,
}: {
  inputAmount?: string;
  totalAmount?: string;
  onDone: () => void;
}) => {
  const intl = useIntl();
  const isShow = useIsKeyboardShown();
  let viewShow = platformEnv.isNativeIOS;
  if (!platformEnv.isNativeIOS) {
    viewShow = isShow;
  }
  return viewShow ? (
    <XStack
      p="$2.5"
      px="$3.5"
      justifyContent="space-between"
      bg="$bgSubdued"
      borderTopWidth="$px"
      borderTopColor="$borderSubduedLight"
    >
      <XStack>
        {totalAmount ? (
          <>
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_page })}{' '}
            </SizableText>
            <SizableText size="$bodyLg" color="$text">
              {inputAmount ?? ''}
            </SizableText>
            <SizableText size="$bodyLg" color="$textSubdued">
              {' '}
              / {totalAmount}
            </SizableText>
          </>
        ) : null}
        {inputAmount && !totalAmount ? (
          <SizableText size="$bodyLg" color="$textSubdued">
            {inputAmount}
          </SizableText>
        ) : null}
      </XStack>
      <Button
        variant="tertiary"
        onPress={() => {
          Keyboard.dismiss();
          onDone();
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_done })}
      </Button>
    </XStack>
  ) : null;
};

type IInputWithAccessoryDoneViewProps = IInputProps & {
  xStackProps?: IXStackProps;
  totalPages?: number;
  onDone: () => void;
};
export const InputWithAccessoryDoneView = ({
  xStackProps,
  totalPages,
  onDone,
  ...props
}: IInputWithAccessoryDoneViewProps) => {
  return (
    <XStack {...(xStackProps ?? {})}>
      <Input
        {...props}
        onBlur={(e) => {
          if (props.onBlur) {
            props.onBlur(e);
          }
        }}
        onFocus={(e) => {
          if (props.onFocus) {
            props.onFocus(e);
          }
        }}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={PaginationInputAccessoryViewID}>
          <PaginationDoneOnKeyboard
            inputAmount={props.value}
            totalAmount={totalPages?.toString()}
            onDone={onDone}
          />
        </InputAccessoryView>
      ) : null}
    </XStack>
  );
};

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

  if (totalPages <= 1) return null;
  const handleInputBlur = () => {
    handleInputSubmit();
  };

  return (
    <XStack
      py="$3"
      px="$4"
      gap="$4"
      justifyContent={isMobile ? 'center' : 'flex-start'}
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
        <InputWithAccessoryDoneView
          value={inputValue}
          inputAccessoryViewID={PaginationInputAccessoryViewID}
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
          onDone={handleInputSubmit}
          xStackProps={{
            w: isMobile ? 40 : undefined,
          }}
          totalPages={totalPages}
        />
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
  listLoading?: boolean;
  paginationToBottom?: boolean;
  listViewDebugRenderTrackerProps?: IDebugRenderTrackerProps;
}

export function CommonTableListView({
  columns,
  data,
  useTabsList,
  renderRow,
  currentListPage,
  listLoading,
  setCurrentListPage,
  paginationToBottom,
  isMobile,
  emptyMessage = 'No data',
  emptySubMessage = 'Data will appear here',
  minTableWidth,
  headerBgColor = '$bgSubtle',
  headerTextColor = '$textSubdued',
  borderColor = '$borderSubdued',
  enablePagination = false,
  pageSize = 20,
  listViewDebugRenderTrackerProps,
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

  const actions = useHyperliquidActions();

  const onRefresh = useCallback(async () => {
    await actions.current.refreshAllPerpsData();
  }, [actions]);

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

  if (isMobile) {
    const ListContent = (
      <DebugRenderTracker {...listViewDebugRenderTrackerProps}>
        <ListComponent
          refreshControl={<PullToRefresh onRefresh={onRefresh} />}
          data={paginatedData}
          ListFooterComponent={
            enablePagination &&
            currentListPage &&
            totalPages > 1 &&
            !paginationToBottom ? (
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
            listLoading ? (
              <TradesHistoryLoadingView />
            ) : (
              <YStack flex={1} alignItems="center" p="$6">
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
            )
          }
          contentContainerStyle={{
            paddingBottom: enablePagination && totalPages > 1 ? 0 : 16,
          }}
        />
      </DebugRenderTracker>
    );
    if (paginationToBottom && currentListPage && totalPages > 1) {
      return (
        <YStack flex={1}>
          {ListContent}
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
        </YStack>
      );
    }
    return ListContent;
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
                            borderBottomWidth="$px"
                            borderTopWidth={0}
                            borderLeftWidth={0}
                            borderRightWidth={0}
                            borderBottomColor="$border"
                            borderStyle="dashed"
                            cursor="help"
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
              debugRenderTrackerProps={listViewDebugRenderTrackerProps}
              style={{
                height: 400,
              }}
              data={paginatedData}
              renderItem={({ item, index }) => {
                return renderRow(item, index);
              }}
              ListEmptyComponent={
                listLoading ? (
                  <YStack
                    flex={1}
                    justifyContent="flex-start"
                    alignItems="flex-start"
                    p="$5"
                    gap="$3"
                  >
                    {[...Array(5)].map((_, index) => (
                      <XStack
                        key={index}
                        flex={1}
                        py="$1.5"
                        px="$3"
                        alignItems="center"
                        minWidth={minTableWidth}
                        {...(index % 2 === 1 && {
                          backgroundColor: '$bgSubdued',
                        })}
                      >
                        {columns.map((column, colIndex) => (
                          <XStack
                            key={column.key}
                            {...getColumnStyle(column)}
                            justifyContent={calcCellAlign(column.align) as any}
                            alignItems="center"
                            {...(colIndex === 0 && {
                              pl: '$2',
                            })}
                          >
                            <Skeleton h="$3" w="$16" />
                          </XStack>
                        ))}
                      </XStack>
                    ))}
                  </YStack>
                ) : (
                  <YStack
                    flex={1}
                    justifyContent="flex-start"
                    alignItems="flex-start"
                    p="$5"
                  >
                    <SizableText
                      size="$bodyMd"
                      color="$text"
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
                )
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
