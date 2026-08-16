import { memo, useCallback, useContext, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  ListEndIndicator,
  SizableText,
  Stack,
  Table,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import { REDESIGN_ROW_HEIGHT } from '../marketListRedesignVisuals';
import { StickyHeaderPortal } from '../StickyHeaderPortal';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';
import { usePerpsClientSort } from './hooks/usePerpsClientSort';
import { usePerpsColumns } from './hooks/usePerpsColumns';
import { useSyncedMarketPerpsCategory } from './hooks/useSyncedMarketPerpsCategory';
import { MarketPerpsCategorySelector } from './MarketPerpsCategorySelector';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

type IMarketPerpsTokenListProps = {
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
};

function MarketPerpsTokenListImpl({
  tabIntegrated,
  tabName,
  listContainerProps,
}: IMarketPerpsTokenListProps) {
  const { navigateToPerps } = usePerpsNavigation();
  const intl = useIntl();
  const { md } = useMedia();

  const {
    perpsCategories: categoryTabs,
    selectedCategoryId,
    handleSelectCategory,
  } = useSyncedMarketPerpsCategory();

  const { tokens, isLoading, hasRealTimeData } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const perpsColumns = usePerpsColumns();
  const {
    sortedTokens,
    onHeaderRow: handleHeaderRow,
    controlledSort,
  } = usePerpsClientSort({ tokens });

  const handleTokenPress = navigateToPerps;

  // Keeps the portalled header's useMemo from rebuilding on every sort change.
  const handleHeaderRowRef = useRef(handleHeaderRow);
  handleHeaderRowRef.current = handleHeaderRow;
  const stableHandleHeaderRow = useCallback(
    (...args: Parameters<typeof handleHeaderRow>) =>
      handleHeaderRowRef.current(...args),
    [],
  );

  const CategorySelector = useMemo(
    () => (
      <MarketPerpsCategorySelector
        categories={categoryTabs}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        containerStyle={{
          px: '$4',
          pt: '$3',
          pb: '$2',
        }}
      />
    ),
    [categoryTabs, handleSelectCategory, selectedCategoryId],
  );

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

  const tabBarHeight = useScrollContentTabBarOffset();

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [isLoading, intl]);

  const TableFooterComponent = useMemo(() => {
    if (!isLoading && tokens.length > 0) {
      return <ListEndIndicator />;
    }
    return null;
  }, [isLoading, tokens.length]);

  const webTabIntegrated = tabIntegrated && !platformEnv.isNative;

  // Desktop sticky header: portal the category selector + column header
  // into the renderTabBar area so they stick when scrolling.
  const stickyHeaderCtx = useContext(DesktopStickyHeaderContext);
  const stickyPortalTarget = stickyHeaderCtx?.portalTarget ?? null;
  const isTabFocused = !tabName || stickyHeaderCtx?.activeTabName === tabName;
  const useDesktopPortal = webTabIntegrated && !!stickyPortalTarget && !md;

  const portalContent = useMemo(() => {
    if (!useDesktopPortal || !isTabFocused || !stickyPortalTarget) return null;
    return (
      <StickyHeaderPortal target={stickyPortalTarget}>
        {/* Same bottom padding as the spot lists, so the first row clears the
            pinned header by the same amount on every tab. */}
        <YStack bg="$bgApp" px="$4" pb="$2">
          <Stack width="100%" mb="$3">
            {CategorySelector}
          </Stack>
          <Table.HeaderRow
            columns={perpsColumns}
            onHeaderRow={stableHandleHeaderRow}
            controlledSort={controlledSort}
          />
        </YStack>
      </StickyHeaderPortal>
    );
  }, [
    useDesktopPortal,
    isTabFocused,
    stickyPortalTarget,
    CategorySelector,
    perpsColumns,
    stableHandleHeaderRow,
    controlledSort,
  ]);

  let integratedContentPaddingBottom = tabBarHeight;
  if (platformEnv.isNativeAndroid) {
    integratedContentPaddingBottom = listContainerProps?.paddingBottom ?? 104;
  } else if (webTabIntegrated) {
    integratedContentPaddingBottom =
      listContainerProps?.paddingBottom ?? tabBarHeight;
  }

  const tableContentContainerStyle = tabIntegrated
    ? {
        // 4px like the spot lists (MarketTokenListBase); together with the
        // header's pb this keeps the first row at the same y on every tab.
        paddingTop: 4 + (platformEnv.isNative ? 150 : 0),
        paddingBottom: integratedContentPaddingBottom,
      }
    : {
        paddingBottom: platformEnv.isNativeAndroid ? 104 : tabBarHeight,
      };

  return (
    <Stack flex={1} width="100%">
      {portalContent}
      {useDesktopPortal ? null : CategorySelector}
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          paddingTop: 4,
          overflowX: 'auto',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack flex={1} minHeight={platformEnv.isNative ? undefined : 400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={perpsColumns}
              count={20}
              rowProps={{ minHeight: REDESIGN_ROW_HEIGHT }}
            />
          ) : (
            <Table<IMarketPerpsToken>
              contentContainerStyle={tableContentContainerStyle}
              stickyHeader
              showHeader={!useDesktopPortal}
              tabIntegrated={tabIntegrated}
              scrollEnabled={!webTabIntegrated}
              columns={perpsColumns}
              dataSource={sortedTokens}
              onHeaderRow={stableHandleHeaderRow}
              controlledSort={controlledSort}
              keyExtractor={(item) => item.name}
              // Same row box as the spot tables, so switching tabs does not
              // shift every row below the first.
              rowProps={{ minHeight: REDESIGN_ROW_HEIGHT }}
              estimatedItemSize={REDESIGN_ROW_HEIGHT}
              extraData={hasRealTimeData}
              TableEmptyComponent={TableEmptyComponent}
              TableFooterComponent={TableFooterComponent}
              onRow={(item) => ({
                onPress: () => handleTokenPress(item.name),
              })}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

export const MarketPerpsTokenList = memo(MarketPerpsTokenListImpl);
export type { IMarketPerpsTokenListProps };
