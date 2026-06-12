import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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
  type IMarketPerpsToken,
  mapServerToken,
} from '../MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { usePerpsColumns } from '../MarketHomeV2/components/MarketPerpsList/hooks/usePerpsColumns';

import { BannerDetailTokenFlatList } from './BannerDetailTokenFlatList';

import type { IBannerDetailSortType } from './BannerDetailListColumnHeader';
import type { IMarketToken } from '../MarketHomeV2/components/MarketTokenList/MarketTokenData';

function safeNumber(value: string | number | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export function PerpsTokenListSection({
  tokenListId,
  priceSortType,
  changeSortType,
  change24hColumnTitle,
  onPriceSortPress,
  onChangeSortPress,
}: {
  tokenListId: string;
  priceSortType?: IBannerDetailSortType;
  changeSortType?: IBannerDetailSortType;
  change24hColumnTitle: string;
  onPriceSortPress: () => void;
  onChangeSortPress: () => void;
}) {
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketBanner,
  );
  const perpsColumns = usePerpsColumns();
  const { gtMd, md } = useMedia();
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

  const mobileTokens = useMemo<IMarketToken[]>(
    () =>
      tokens.map((token) => ({
        id: `perps-${token.name}`,
        name: token.displayName,
        symbol: token.displayName,
        address: token.name,
        decimals: 0,
        price: safeNumber(token.markPrice),
        change24h: safeNumber(token.change24hPercent),
        marketCap: 0,
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        turnover: safeNumber(token.volume24h),
        tokenImageUri: token.tokenImageUrl || '',
        networkLogoUri: '',
        networkId: '',
        chainId: '',
        maxLeverage: token.maxLeverage,
        perpsSubtitle: token.subtitle,
        perpsCoin: token.name,
      })),
    [tokens],
  );

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

  const handleMobileItemPress = useCallback(
    (item: IMarketToken) => {
      if (item.perpsCoin) {
        navigateToPerps(item.perpsCoin);
      }
    },
    [navigateToPerps],
  );

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

  if (platformEnv.isNative && !gtMd) {
    return (
      <BannerDetailTokenFlatList
        data={mobileTokens}
        isLoading={showSkeleton}
        priceSortType={priceSortType}
        changeSortType={changeSortType}
        change24hColumnTitle={change24hColumnTitle}
        onPriceSortPress={onPriceSortPress}
        onChangeSortPress={onChangeSortPress}
        onItemPress={handleMobileItemPress}
      />
    );
  }

  return (
    <Stack flex={1} width="100%">
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
              rowProps={{ minHeight: '$14' }}
            />
          ) : (
            <Table<IMarketPerpsToken>
              stickyHeader
              columns={perpsColumns}
              dataSource={tokens}
              keyExtractor={(item) => item.name}
              estimatedItemSize="$14"
              extraData={tokens.length}
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
