import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  LinearGradient,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Table,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInviteCodeListItem,
  IInviteCodeListResponse,
} from '@onekeyhq/shared/src/referralCode/type';

import { useSortableData } from './hooks/useSortableData';
import { useTableAvailableWidth } from './hooks/useTableAvailableWidth';
import { useTableColumns } from './hooks/useTableColumns';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface IInviteCodeListTableProps {
  codeListData: IInviteCodeListResponse | undefined;
  isLoading: boolean;
  refetch: () => void;
}

export function InviteCodeListTable({
  codeListData,
  isLoading,
  refetch,
}: IInviteCodeListTableProps) {
  const intl = useIntl();
  const { containerWidth, onLayout } = useTableAvailableWidth();
  const themeVariant = useThemeVariant();
  const isDark = themeVariant === 'dark';

  const hasCodeListData = Boolean(codeListData);
  const isInitialLoading = !hasCodeListData && (isLoading ?? true);

  // Sort data
  const { sortedData, handleSortChange } = useSortableData(codeListData?.items);

  // Define columns with container width
  const {
    columns,
    fixedColumns,
    scrollableColumns,
    handleHeaderRow,
    shouldUseFlex,
  } = useTableColumns(containerWidth, handleSortChange, refetch);

  // Fixed column shadow management
  // For left-fixed column: show shadow when scrollLeft > 0 (content hidden on left)
  const [showFixedShadow, setShowFixedShadow] = useState(false);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  // Web: get underlying DOM element
  const getScrollElement = useCallback((): HTMLElement | null => {
    if (platformEnv.isNative) return null;
    const ref = scrollViewRef.current;
    if (!ref) return null;
    const scrollableNode = ref.getScrollableNode?.();
    return scrollableNode instanceof HTMLElement ? scrollableNode : null;
  }, []);

  // Web: check shadow visibility based on scroll position
  const checkShadowVisibilityWeb = useCallback(() => {
    const element = getScrollElement();
    if (!element) return;
    const { scrollLeft } = element;
    const shouldShow = scrollLeft > 1;
    setShowFixedShadow((prev) => (prev !== shouldShow ? shouldShow : prev));
  }, [getScrollElement]);

  // Native: handle scroll event
  const handleNativeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const shouldShow = contentOffset.x > 1;
      setShowFixedShadow((prev) => (prev !== shouldShow ? shouldShow : prev));
    },
    [],
  );

  // Web: setup ResizeObserver
  useEffect(() => {
    if (platformEnv.isNative || shouldUseFlex) return;
    if (typeof ResizeObserver === 'undefined') return;
    const element = getScrollElement();
    if (!element) return;
    checkShadowVisibilityWeb();
    const resizeObserver = new ResizeObserver(checkShadowVisibilityWeb);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [shouldUseFlex, checkShadowVisibilityWeb, getScrollElement]);

  // Loading state
  if (isInitialLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py="$10">
        <Spinner size="large" />
      </Stack>
    );
  }

  // Empty state
  if (sortedData.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" py="$10">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }

  // Shadow colors for gradient (native)
  const shadowGradientColors: [string, string] = isDark
    ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0)']
    : ['rgba(0, 0, 0, 0.12)', 'rgba(0, 0, 0, 0)'];

  // Table with horizontal scroll support when needed
  return shouldUseFlex ? (
    // Flex layout: table fits in container, no scroll needed
    <Stack flex={1} onLayout={onLayout}>
      <Table<IInviteCodeListItem>
        dataSource={sortedData}
        columns={columns}
        keyExtractor={(item) => item.code}
        onHeaderRow={handleHeaderRow}
        estimatedItemSize={50}
        rowProps={{ px: '$2', minHeight: '$10' }}
      />
    </Stack>
  ) : (
    // Fixed width with fixed first column: table needs horizontal scroll
    <XStack flex={1} onLayout={onLayout}>
      {/* Fixed column with shadow */}
      <YStack
        bg="$bgApp"
        zIndex={1}
        $platform-web={{
          boxShadow:
            showFixedShadow && sortedData.length > 0
              ? isDark
                ? '12px 0 12px rgba(255, 255, 255, 0.1)'
                : '12px 0 12px rgba(0, 0, 0, 0.15)'
              : 'none',
          clipPath: 'inset(0 -20px 0 0)',
          transition: 'box-shadow 0.2s ease-in-out',
        }}
      >
        <Table<IInviteCodeListItem>
          dataSource={sortedData}
          columns={fixedColumns}
          keyExtractor={(item) => item.code}
          onHeaderRow={handleHeaderRow}
          estimatedItemSize={50}
          rowProps={{ px: '$2', minHeight: '$10' }}
          scrollEnabled={false}
        />
        {/* Native shadow overlay using gradient */}
        {platformEnv.isNative && showFixedShadow && sortedData.length > 0 ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            right={-12}
            width={12}
            pointerEvents="none"
          >
            <LinearGradient
              width="100%"
              height="100%"
              colors={shadowGradientColors}
              start={[0, 0]}
              end={[1, 0]}
            />
          </Stack>
        ) : null}
      </YStack>

      {/* Scrollable columns */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator
        bounces={false}
        onScroll={
          platformEnv.isNative ? handleNativeScroll : checkShadowVisibilityWeb
        }
        scrollEventThrottle={16}
        contentContainerStyle={{
          flexGrow: 1,
        }}
      >
        <Table<IInviteCodeListItem>
          dataSource={sortedData}
          columns={scrollableColumns}
          keyExtractor={(item) => item.code}
          onHeaderRow={handleHeaderRow}
          estimatedItemSize={50}
          rowProps={{ px: '$2', minHeight: '$10' }}
          scrollEnabled={false}
        />
      </ScrollView>
    </XStack>
  );
}
