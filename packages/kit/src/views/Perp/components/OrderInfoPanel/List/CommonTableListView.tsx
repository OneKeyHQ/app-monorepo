import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  Spinner,
  Stack,
  Tabs,
  Tooltip,
  XStack,
  YStack,
  useIsKeyboardShown,
} from '@onekeyhq/components';
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
  onViewAll,
}: {
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageChange: (page: number) => void;
  headerBgColor: string;
  headerTextColor: string;
  isMobile?: boolean;
  onViewAll?: () => void;
}) => {
  const intl = useIntl();
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
      {totalPages > 1 ? (
        <>
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
        </>
      ) : null}
      {onViewAll ? (
        <Button
          variant="tertiary"
          size="small"
          onPress={() => {
            onViewAll();
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_view_more })}
        </Button>
      ) : null}
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
  fixed?: boolean;
}

export type IRenderMode = 'full' | 'left' | 'right';

export interface ICommonTableListViewProps<T = unknown> {
  columns: IColumnConfig[];
  data: T[];
  renderRow: (
    item: T,
    index: number,
    renderMode?: IRenderMode,
    isHovered?: boolean,
    onHoverChange?: (index: number | null) => void,
  ) => ReactElement;
  emptyMessage?: string;
  emptySubMessage?: string;
  minTableWidth?: number;
  headerBgColor?: string;
  headerTextColor?: string;
  borderColor?: string;
  rowHoverColor?: string;
  isMobile?: boolean;
  // pagination
  enablePagination?: boolean;
  pageSize?: number;
  currentListPage?: number;
  setCurrentListPage?: (page: number) => void;
  useTabsList?: boolean;
  disableListScroll?: boolean;
  listLoading?: boolean;
  paginationToBottom?: boolean;
  listViewDebugRenderTrackerProps?: IDebugRenderTrackerProps;
  onViewAll?: () => void;
  onPullToRefresh?: () => Promise<void>;
  ListHeaderComponent?: ReactElement | null;
}

export function CommonTableListView<T>({
  columns,
  data,
  useTabsList,
  disableListScroll,
  renderRow,
  currentListPage,
  listLoading,
  setCurrentListPage,
  paginationToBottom,
  isMobile,
  emptyMessage = 'No data',
  emptySubMessage = 'Data will appear here',
  minTableWidth: _minTableWidth,
  headerBgColor = '$bgSubtle',
  headerTextColor = '$textSubdued',
  borderColor = '$borderSubdued',
  enablePagination = true,
  pageSize = 20,
  listViewDebugRenderTrackerProps,
  onViewAll,
  onPullToRefresh,
  ListHeaderComponent,
}: ICommonTableListViewProps<T>) {
  const shouldUseTabsList = useTabsList ?? true;

  const scrollableColumns = useMemo(
    () => columns.filter((c) => !c.fixed),
    [columns],
  );
  const fixedColumns = useMemo(() => columns.filter((c) => c.fixed), [columns]);
  const hasFixedColumns = fixedColumns.length > 0;

  const scrollableMinWidth = useMemo(
    () =>
      scrollableColumns.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [scrollableColumns],
  );
  const fixedMinWidth = useMemo(
    () =>
      fixedColumns.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [fixedColumns],
  );

  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  // Fixed column shadow management (web/desktop only)
  // Native: Shadow effect is not supported, this logic is skipped via platformEnv check
  // Web/Desktop: Uses ResizeObserver and scroll position to show/hide shadow for fixed columns
  const [showFixedShadow, setShowFixedShadow] = useState(true);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  // Get underlying DOM element from ScrollView (web/desktop only)
  // Native: Returns null as DOM APIs are not available
  // Web/Desktop: Uses getScrollableNode() to access the actual scrollable HTMLElement
  const getScrollElement = useCallback((): HTMLElement | null => {
    if (platformEnv.isNative) return null;
    const ref = scrollViewRef.current;
    if (!ref) return null;
    const scrollableNode = ref.getScrollableNode?.();
    return scrollableNode instanceof HTMLElement ? scrollableNode : null;
  }, []);

  const checkShadowVisibility = useCallback(() => {
    const element = getScrollElement();
    if (!element) return;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    const needsScroll = scrollWidth > clientWidth + 1;
    const isScrolledToEnd = scrollLeft + clientWidth >= scrollWidth - 1;
    const shouldShow = needsScroll && !isScrolledToEnd;
    setShowFixedShadow((prev) => (prev !== shouldShow ? shouldShow : prev));
  }, [getScrollElement]);

  // Monitor scroll container size changes to update shadow visibility (web/desktop only)
  // Native: Skipped via platformEnv.isNative check
  // Web/Desktop: Uses ResizeObserver (web API) to detect when container is resized
  useEffect(() => {
    if (platformEnv.isNative || !hasFixedColumns) return;
    if (typeof ResizeObserver === 'undefined') return;
    const element = getScrollElement();
    if (!element) return;
    checkShadowVisibility();
    const resizeObserver = new ResizeObserver(checkShadowVisibility);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [hasFixedColumns, checkShadowVisibility, getScrollElement]);

  const paginatedData = useMemo<T[]>(() => {
    if (!enablePagination || data.length <= pageSize || !currentListPage) {
      return data;
    }
    const startIndex = (currentListPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
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
  const ListComponent = shouldUseTabsList ? Tabs.FlatList : ListView;

  if (isMobile) {
    const ListContent = (
      <DebugRenderTracker {...listViewDebugRenderTrackerProps}>
        <ListComponent
          refreshControl={
            shouldUseTabsList && onPullToRefresh ? (
              <PullToRefresh onRefresh={onPullToRefresh} />
            ) : undefined
          }
          windowSize={
            platformEnv.isNativeAndroid && shouldUseTabsList ? 3 : undefined
          }
          scrollEnabled={shouldUseTabsList || !disableListScroll}
          data={paginatedData}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={
            enablePagination &&
            currentListPage &&
            totalPages > 1 &&
            !paginationToBottom ? (
              <PaginationFooter
                isMobile={isMobile}
                currentPage={currentListPage ?? 1}
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
            return renderRow(item, index, 'full');
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
    if (
      (paginationToBottom && currentListPage && totalPages > 1) ||
      onViewAll
    ) {
      return (
        <YStack flex={1}>
          {ListContent}
          <PaginationFooter
            isMobile={isMobile}
            currentPage={currentListPage ?? 1}
            totalPages={totalPages}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            onViewAll={onViewAll}
            onPageChange={handlePageChange}
            headerBgColor={headerBgColor}
            headerTextColor={headerTextColor}
          />
        </YStack>
      );
    }
    return ListContent;
  }

  const renderHeaderCell = (column: IColumnConfig, _index: number) => (
    <XStack
      key={column.key}
      {...getColumnStyle(column)}
      justifyContent={calcCellAlign(column.align) as any}
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
              color={column.onPress ? '$textSuccess' : headerTextColor}
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
          borderBottomWidth="$px"
          borderBottomColor="transparent"
          color={column.onPress ? '$textSuccess' : headerTextColor}
          fontWeight="600"
          textAlign={column.align || 'left'}
        >
          {column.title}
        </SizableText>
      )}
    </XStack>
  );

  return (
    <YStack flex={1}>
      <Tabs.ScrollView
        style={{
          flex: 1,
        }}
        nestedScrollEnabled
      >
        <XStack flex={1}>
          {/* Scrollable columns */}
          <ScrollView
            ref={scrollViewRef}
            style={{
              flex: 1,
            }}
            horizontal
            showsHorizontalScrollIndicator
            nestedScrollEnabled
            onScroll={checkShadowVisibility}
            scrollEventThrottle={16}
            contentContainerStyle={{
              minWidth: scrollableMinWidth,
              flexGrow: 1,
            }}
          >
            <YStack flex={1} minWidth={scrollableMinWidth} cursor="default">
              <XStack
                py="$2"
                px="$3"
                display="flex"
                minWidth={scrollableMinWidth}
                width="100%"
                borderBottomWidth="$px"
                borderBottomColor={borderColor}
                bg={headerBgColor}
              >
                {scrollableColumns.map((column, index) =>
                  renderHeaderCell(column, index),
                )}
              </XStack>
              <YStack flex={1} pb={enablePagination ? 0 : '$4'}>
                {listLoading ? (
                  <YStack
                    flex={1}
                    justifyContent="center"
                    alignItems="center"
                    p="$20"
                  >
                    <Spinner size="large" />
                  </YStack>
                ) : null}
                {!listLoading && paginatedData.length === 0 ? (
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
                ) : null}
                {!listLoading && paginatedData.length > 0
                  ? paginatedData.map((item, index) =>
                      renderRow(
                        item,
                        index,
                        hasFixedColumns ? 'left' : 'full',
                        hoveredRowIndex === index,
                        setHoveredRowIndex,
                      ),
                    )
                  : null}
              </YStack>
            </YStack>
          </ScrollView>

          {/* Fixed columns */}
          {hasFixedColumns ? (
            <YStack
              minWidth={fixedMinWidth}
              cursor="default"
              bg="$bgApp"
              $platform-web={{
                boxShadow:
                  showFixedShadow && paginatedData.length > 0
                    ? '-4px 0 8px rgba(0, 0, 0, 0.08)'
                    : 'none',
                transition: 'box-shadow 0.2s ease-in-out',
              }}
            >
              <XStack
                py="$2"
                px="$3"
                display="flex"
                borderBottomWidth="$px"
                borderBottomColor={borderColor}
                bg={headerBgColor}
              >
                {fixedColumns.map((column, index) =>
                  renderHeaderCell(column, index),
                )}
              </XStack>
              <YStack flex={1} pb={enablePagination ? 0 : '$4'}>
                {listLoading ? <YStack flex={1} p="$20" /> : null}
                {!listLoading && paginatedData.length === 0 ? (
                  <YStack flex={1} p="$5" />
                ) : null}
                {!listLoading && paginatedData.length > 0
                  ? paginatedData.map((item, index) =>
                      renderRow(
                        item,
                        index,
                        'right',
                        hoveredRowIndex === index,
                        setHoveredRowIndex,
                      ),
                    )
                  : null}
              </YStack>
            </YStack>
          ) : null}
        </XStack>

        {enablePagination && currentListPage ? (
          <PaginationFooter
            currentPage={currentListPage}
            totalPages={totalPages}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            onPageChange={handlePageChange}
            isMobile={isMobile}
            headerBgColor={headerBgColor}
            headerTextColor={headerTextColor}
            onViewAll={onViewAll}
          />
        ) : null}
      </Tabs.ScrollView>
    </YStack>
  );
}
