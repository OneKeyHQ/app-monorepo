import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import { SizableText, Stack, Table, useMedia } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePerpsNavigation } from '../hooks/usePerpsNavigation';
import {
  MARKET_LIST_HEADER_ROW_HEIGHT,
  MARKET_LIST_ROW_HEIGHT,
} from '../marketDesktopLayoutConstants';
import {
  PERPS_METRIC_COLUMN_MINIMUM_WIDTHS,
  PERPS_SORTABLE_FIELDS,
} from '../MarketHomeV2/components/MarketPerpsList/constants';
import {
  type IMarketPerpsToken,
  mapServerToken,
} from '../MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { usePerpsColumns } from '../MarketHomeV2/components/MarketPerpsList/hooks/usePerpsColumns';
import { MarketPerpsTokenListItem } from '../MarketHomeV2/components/MarketPerpsList/MarketPerpsTokenListItem';
import { TokenListSkeleton } from '../MarketHomeV2/components/MarketTokenList/components/TokenListSkeleton';
import { sortMarketTokenListData } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { useMarketDesktopResponsiveColumns } from '../MarketHomeV2/components/useMarketDesktopResponsiveColumns';

import { BannerDetailListColumnHeader } from './BannerDetailListColumnHeader';
import { useBannerDetailTableSort } from './useBannerDetailTableSort';

import type { IBannerDetailSortType } from './BannerDetailListColumnHeader';
import type { FlatListProps } from 'react-native';

export function PerpsTokenListSection({
  tokenListId,
  changeSortType,
  change24hColumnTitle,
  onChangeSortPress,
}: {
  tokenListId: string;
  changeSortType?: IBannerDetailSortType;
  change24hColumnTitle: string;
  onChangeSortPress: () => void;
}) {
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketBanner,
  );
  const basePerpsColumns = usePerpsColumns();
  const { gtMd, md } = useMedia();
  const {
    columns: perpsColumns,
    handleContainerLayout: handleResponsiveContainerLayout,
  } = useMarketDesktopResponsiveColumns({
    columns: basePerpsColumns,
    enabled: !platformEnv.isNative && !md,
    firstColumnCount: 2,
    metricColumnMinimumWidths: PERPS_METRIC_COLUMN_MINIMUM_WIDTHS,
  });
  const tabBarHeight = useTabBarHeight();
  const intl = useIntl();

  const { result: perpsResult, isLoading } = usePromiseResult(
    async () => {
      const [tokenListData, tokenSearchAliases] = await Promise.all([
        backgroundApiProxy.serviceMarketV2.fetchMarketBannerPerpsTokenList({
          tokenListId,
        }),
        backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
      ]);
      return { tokenListData, tokenSearchAliases };
    },
    [tokenListId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: true,
    },
  );

  const tokens = useMemo(() => {
    if (!perpsResult?.tokenListData?.tokens) return [];
    return perpsResult.tokenListData.tokens.map((t) =>
      mapServerToken(t, perpsResult.tokenSearchAliases),
    );
  }, [perpsResult]);

  const { sortedData: sortedTokens, handleHeaderRow } =
    useBannerDetailTableSort({
      data: tokens,
      columns: perpsColumns,
      sortableFields: PERPS_SORTABLE_FIELDS,
    });

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

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

  // The mobile Perps tab's rows under the banner's sortable column header.
  const renderMobileItem: FlatListProps<IMarketPerpsToken>['renderItem'] =
    useCallback(
      ({ item }) => (
        <MarketPerpsTokenListItem
          item={item}
          onPress={() => navigateToPerps(item.name)}
        />
      ),
      [navigateToPerps],
    );
  const mobileSortedTokens = useMemo(
    () =>
      sortMarketTokenListData({
        data: tokens,
        field: changeSortType ? 'change24hPercent' : undefined,
        order: changeSortType,
      }),
    [changeSortType, tokens],
  );

  if (!gtMd) {
    return (
      <Stack flex={1}>
        <BannerDetailListColumnHeader
          // Same label as the mobile home lists: the row's second line is the
          // contract's volume.
          primaryColumnTitle={`${intl.formatMessage({
            id: ETranslations.global_name,
          })} / ${intl.formatMessage({
            id: ETranslations.market_stock_volume__title,
          })}`}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onChangeSortPress={onChangeSortPress}
        />
        {showSkeleton ? (
          <TokenListSkeleton count={15} />
        ) : (
          <FlatList<IMarketPerpsToken>
            style={{ flex: 1 }}
            data={mobileSortedTokens}
            renderItem={renderMobileItem}
            keyExtractor={(item) => item.name}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            contentContainerStyle={{ paddingBottom: tabBarHeight }}
            ListEmptyComponent={TableEmptyComponent}
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack flex={1} width="100%" onLayout={handleResponsiveContainerLayout}>
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
              stickyHeader
              columns={perpsColumns}
              dataSource={sortedTokens}
              keyExtractor={(item) => item.name}
              rowProps={{ height: MARKET_LIST_ROW_HEIGHT }}
              headerRowProps={{ height: MARKET_LIST_HEADER_ROW_HEIGHT }}
              estimatedItemSize={MARKET_LIST_ROW_HEIGHT}
              extraData={tokens.length}
              onHeaderRow={handleHeaderRow}
              TableEmptyComponent={TableEmptyComponent}
              contentContainerStyle={{
                paddingBottom: tabBarHeight,
              }}
              onRow={(item) => ({
                onPress: () => navigateToPerps(item.name),
              })}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
