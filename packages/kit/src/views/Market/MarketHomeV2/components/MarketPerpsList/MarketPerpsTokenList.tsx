import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  ListEndIndicator,
  SizableText,
  Stack,
  Table,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { ETableSortType, ITableColumn } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { MARKET_LIST_ROW_HEIGHT } from '../../../marketDesktopLayoutConstants';
import { MarketTestIDs } from '../../../testIDs';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import { MarketDesktopStickyHeader } from '../MarketDesktopStickyHeader';
import { StickyHeaderPortal } from '../StickyHeaderPortal';
import { useMarketDesktopResponsiveColumns } from '../useMarketDesktopResponsiveColumns';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';
import { usePerpsColumns } from './hooks/usePerpsColumns';
import { useSyncedMarketPerpsCategory } from './hooks/useSyncedMarketPerpsCategory';
import { MarketPerpsCategorySelector } from './MarketPerpsCategorySelector';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

// The numeric columns the design marks sortable, keyed by their `dataIndex`.
const PERPS_SORTABLE_FIELDS: Record<string, keyof IMarketPerpsToken> = {
  price: 'markPrice',
  change24h: 'change24hPercent',
  fundingRate: 'fundingRate',
  volume24h: 'volume24h',
  openInterest: 'openInterest',
};
const PERPS_METRIC_COLUMN_MINIMUM_WIDTHS = {
  change24h: 168,
  fundingRate: 112,
  openInterest: 112,
  price: 112,
  volume24h: 112,
} as const;

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

  const basePerpsColumns = usePerpsColumns();

  // `/utility/v2/market/perps/token-list` has no paging at all — it answers
  // with the whole set — so the table sorts in place.
  const [sort, setSort] = useState<{
    field: keyof IMarketPerpsToken;
    order: 'asc' | 'desc';
  }>();
  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketPerpsToken>) => {
      const field = PERPS_SORTABLE_FIELDS[String(column.dataIndex)];
      if (!field) {
        return undefined;
      }
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          setSort(order ? { field, order } : undefined);
        },
        initialSortOrder:
          sort?.field === field ? (sort.order as ETableSortType) : undefined,
      };
    },
    [sort],
  );
  const sortedTokens = useMemo(() => {
    if (!sort) {
      return tokens;
    }
    const { field, order } = sort;
    return [...tokens].toSorted((a, b) => {
      const aVal = Number(a[field] ?? 0);
      const bVal = Number(b[field] ?? 0);
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [sort, tokens]);

  const handleTokenPress = navigateToPerps;

  const CategorySelector = useMemo(
    () => (
      <MarketPerpsCategorySelector
        categories={categoryTabs}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
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
  const {
    columns: perpsColumns,
    handleContainerLayout: handleResponsiveContainerLayout,
  } = useMarketDesktopResponsiveColumns({
    columns: basePerpsColumns,
    enabled: !platformEnv.isNative && !md,
    firstColumnCount: 2,
    metricColumnMinimumWidths: PERPS_METRIC_COLUMN_MINIMUM_WIDTHS,
  });
  useEffect(() => {
    if (
      sort &&
      !perpsColumns.some(
        (column) => PERPS_SORTABLE_FIELDS[column.dataIndex] === sort.field,
      )
    ) {
      setSort(undefined);
    }
  }, [perpsColumns, sort]);

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
        <MarketDesktopStickyHeader<IMarketPerpsToken>
          toolbar={CategorySelector}
          columns={perpsColumns}
          onHeaderRow={handleHeaderRow}
        />
      </StickyHeaderPortal>
    );
  }, [
    handleHeaderRow,
    useDesktopPortal,
    isTabFocused,
    stickyPortalTarget,
    CategorySelector,
    perpsColumns,
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
        paddingTop: platformEnv.isNative ? 150 : 0,
        paddingBottom: integratedContentPaddingBottom,
      }
    : {
        paddingBottom: platformEnv.isNativeAndroid ? 104 : tabBarHeight,
      };

  return (
    <Stack
      flex={1}
      width="100%"
      testID={MarketTestIDs.perpsList}
      onLayout={handleResponsiveContainerLayout}
    >
      {portalContent}
      {useDesktopPortal ? null : CategorySelector}
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          overflowX: 'auto',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack flex={1} minHeight={platformEnv.isNative ? undefined : 400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={perpsColumns}
              count={20}
              rowProps={{ height: MARKET_LIST_ROW_HEIGHT }}
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
              keyExtractor={(item) => item.name}
              rowProps={{ height: MARKET_LIST_ROW_HEIGHT }}
              estimatedItemSize={MARKET_LIST_ROW_HEIGHT}
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
