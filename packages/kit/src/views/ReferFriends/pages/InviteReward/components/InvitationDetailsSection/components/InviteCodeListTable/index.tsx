import { useIntl } from 'react-intl';

import {
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Table,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  FixedColumnShadowOverlay,
  SimpleEdgeShadowOverlay,
} from '@onekeyhq/kit/src/components/FixedColumnShadowOverlay';
import {
  SHADOW_CONSTANTS,
  getWebClipPath,
  getWebShadowStyle,
  useFixedColumnShadow,
} from '@onekeyhq/kit/src/hooks/useFixedColumnShadow';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteCodeListResponse } from '@onekeyhq/shared/src/referralCode/type';

import { useDebugCodeLength } from './components/DebugCodeLengthSelector';
import { useSortableData } from './hooks/useSortableData';
import { useTableAvailableWidth } from './hooks/useTableAvailableWidth';
import { useTableColumns } from './hooks/useTableColumns';

import type { IInviteCodeListTableItem } from './const';

const ROW_HEIGHT = 66;

interface IInviteCodeListTableProps {
  codeListData: IInviteCodeListResponse | undefined;
  isLoading: boolean;
  refetch: () => Promise<void>;
  onCodeUpdated?: (shouldRefreshSummary?: boolean) => Promise<void> | void;
}

export function InviteCodeListTable({
  codeListData,
  isLoading,
  refetch,
  onCodeUpdated,
}: IInviteCodeListTableProps) {
  const intl = useIntl();
  const { containerWidth, onLayout } = useTableAvailableWidth();
  const themeVariant = useThemeVariant();
  const isDark = themeVariant === 'dark';

  const hasCodeListData = Boolean(codeListData);
  const isInitialLoading = !hasCodeListData && (isLoading ?? true);

  const { tableItems, debugSelector } = useDebugCodeLength(codeListData?.items);

  // Sort data
  const { sortedData, handleSortChange } = useSortableData(tableItems);

  // Define columns with container width
  const {
    columns,
    fixedColumns,
    scrollableColumns,
    handleHeaderRow,
    shouldUseFlex,
  } = useTableColumns(
    containerWidth,
    handleSortChange,
    onCodeUpdated ?? refetch,
    tableItems,
  );

  // Fixed column shadow management using shared hook
  const {
    showShadow: showFixedShadow,
    scrollViewRef,
    handleNativeScroll,
    handleWebScroll,
  } = useFixedColumnShadow({
    position: 'left',
    enabled: !shouldUseFlex,
  });

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

  // Table with horizontal scroll support when needed
  return shouldUseFlex ? (
    // Flex layout: table fits in container, no scroll needed
    <Stack flex={1} position="relative" onLayout={onLayout}>
      {debugSelector}
      <Table<IInviteCodeListTableItem>
        dataSource={sortedData}
        columns={columns}
        keyExtractor={(item) => item.code}
        onHeaderRow={handleHeaderRow}
        estimatedItemSize={ROW_HEIGHT}
        rowProps={{ px: '$2', minHeight: ROW_HEIGHT }}
      />
      <SimpleEdgeShadowOverlay isDark={isDark} position="right" zIndex={10} />
    </Stack>
  ) : (
    // Fixed width with fixed first column: table needs horizontal scroll
    <YStack flex={1} onLayout={onLayout}>
      {debugSelector}
      <XStack flex={1} position="relative">
        {/* Fixed column with shadow */}
        <YStack
          bg="$bgApp"
          zIndex={1}
          $platform-web={{
            boxShadow: showFixedShadow
              ? getWebShadowStyle('left', isDark)
              : 'none',
            clipPath: getWebClipPath('left'),
            transition: `box-shadow ${SHADOW_CONSTANTS.TRANSITION_DURATION} ease-in-out`,
          }}
        >
          <Table<IInviteCodeListTableItem>
            dataSource={sortedData}
            columns={fixedColumns}
            keyExtractor={(item) => item.code}
            onHeaderRow={handleHeaderRow}
            estimatedItemSize={ROW_HEIGHT}
            rowProps={{ px: '$2', minHeight: ROW_HEIGHT }}
            scrollEnabled={false}
          />
          <FixedColumnShadowOverlay
            position="left"
            visible={showFixedShadow}
            isDark={isDark}
          />
        </YStack>

        {/* Scrollable columns */}
        <ScrollView
          ref={scrollViewRef}
          flex={1}
          horizontal
          showsHorizontalScrollIndicator
          bounces={false}
          onScroll={platformEnv.isNative ? handleNativeScroll : handleWebScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            flexGrow: 1,
          }}
        >
          <Table<IInviteCodeListTableItem>
            dataSource={sortedData}
            columns={scrollableColumns}
            keyExtractor={(item) => item.code}
            onHeaderRow={handleHeaderRow}
            estimatedItemSize={ROW_HEIGHT}
            rowProps={{ px: '$2', minHeight: ROW_HEIGHT }}
            scrollEnabled={false}
          />
        </ScrollView>
      </XStack>
    </YStack>
  );
}
