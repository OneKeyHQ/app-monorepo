import { useCallback, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  ListEndIndicator,
  NavBackButton,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { HeaderNotificationIconButton } from '@onekeyhq/kit/src/components/TabPageHeader/components/HeaderNotificationIconButton';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EJotaiContextStoreNames,
  useMarketBannerListSortAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ECopyFrom,
  EEnterWay,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import { TabPageHeader } from '../../../components/TabPageHeader';
import { useMarketDetailBackNavigation } from '../MarketDetailV2/hooks/useMarketDetailBackNavigation';
import { MarketListColumnHeader } from '../MarketHomeV2/components/MarketListColumnHeader';
import { TokenListItem } from '../MarketHomeV2/components/MarketTokenList/components/TokenListItem';
import { TokenListSkeleton } from '../MarketHomeV2/components/MarketTokenList/components/TokenListSkeleton';
import { useToDetailPage } from '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { MarketTokenListBase } from '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import {
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { PerpsTokenListSection } from './PerpsTokenListSection';

import type { IMarketToken } from '../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { EModalMarketRoutes, IModalMarketParamList } from '../router';
import type { RouteProp } from '@react-navigation/core';

type IMarketBannerDetailRouteParams = RouteProp<
  ITabMarketParamList & IModalMarketParamList,
  ETabMarketRoutes.MarketBannerDetail | EModalMarketRoutes.MarketBannerDetail
>;

function MarketBannerDetailContent({ title }: { title: string }) {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { tokenListId, type } = route.params;
  const isPerps = type === EMarketBannerType.Perps;

  const intl = useIntl();
  const toDetailPage = useToDetailPage({ from: EEnterWay.BannerList });
  const { handleBackPress } = useMarketDetailBackNavigation();
  const { top } = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { gtMd } = useMedia();

  const [bannerSort, setBannerSort] = useMarketBannerListSortAtom();
  const sortRef = useRef(bannerSort);
  sortRef.current = bannerSort;

  const isWebDesktop = (platformEnv.isWeb || platformEnv.isDesktop) && gtMd;

  const renderHeaderLeft = useCallback(
    () => <NavBackButton onPress={handleBackPress} />,
    [handleBackPress],
  );

  const renderHeaderTitle = useCallback(
    () => (
      <SizableText size="$heading2xl" numberOfLines={1} flexShrink={1}>
        {title}
      </SizableText>
    ),
    [title],
  );

  const renderNotificationButton = useCallback(
    () => (
      <HeaderButtonGroup>
        <HeaderNotificationIconButton testID="market-banner-detail-notification" />
      </HeaderButtonGroup>
    ),
    [],
  );

  // Ticker (spot) data fetching
  const { result: tickerResult, isLoading: tickerIsLoading } = usePromiseResult(
    async () => {
      if (isPerps) return null;
      const data =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerTokenList({
          tokenListId,
        });
      return data;
    },
    [tokenListId, isPerps],
    {
      watchLoading: true,
    },
  );

  const transformedData = useMemo(() => {
    if (!tickerResult) return [];
    return tickerResult.map((item, index) => {
      const chainId = item.networkId || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
        sortIndex: index,
      });
    });
  }, [tickerResult]);

  const handleItemPress = useCallback(
    (item: IMarketToken) => {
      void toDetailPage({
        tokenAddress: item.address,
        networkId: item.networkId,
        symbol: item.symbol,
        isNative: item.isNative,
      });
    },
    [toDetailPage],
  );

  const renderBannerItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <TokenListItem item={item} onPress={() => handleItemPress(item)} />
    ),
    [handleItemPress],
  );

  const bannerKeyExtractor = useCallback((item: IMarketToken) => item.id, []);

  const setSortBy = useCallback(
    (val: string | undefined) => {
      const next = { ...sortRef.current, sortBy: val };
      sortRef.current = next;
      setBannerSort(next);
    },
    [setBannerSort],
  );

  const setSortType = useCallback(
    (val: 'asc' | 'desc' | undefined) => {
      const next = { ...sortRef.current, sortType: val };
      sortRef.current = next;
      setBannerSort(next);
    },
    [setBannerSort],
  );

  const listResult = useMemo(
    () => ({
      data: transformedData,
      isLoading: tickerIsLoading,
      setSortBy,
      setSortType,
      currentSortBy: bannerSort.sortBy,
      currentSortType: bannerSort.sortType,
    }),
    [
      transformedData,
      tickerIsLoading,
      setSortBy,
      setSortType,
      bannerSort.sortBy,
      bannerSort.sortType,
    ],
  );

  const renderPageHeader = useMemo(() => {
    if (isWebDesktop) {
      return (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Market}
        />
      );
    }
    if (gtMd) {
      return (
        <Page.Header
          headerTitle={renderHeaderTitle}
          headerLeft={renderHeaderLeft}
          headerRight={renderNotificationButton}
        />
      );
    }
    return <Page.Header headerShown={false} />;
  }, [
    isWebDesktop,
    gtMd,
    renderHeaderLeft,
    renderNotificationButton,
    renderHeaderTitle,
  ]);

  const renderTitleSection = useMemo(() => {
    if (isWebDesktop) {
      return (
        <XStack ai="center" px="$2" pt="$6">
          {renderHeaderTitle()}
        </XStack>
      );
    }
    if (!gtMd) {
      return (
        <XStack ai="center" gap="$4" px="$4">
          {renderHeaderLeft()}
          {renderHeaderTitle()}
        </XStack>
      );
    }
    return null;
  }, [isWebDesktop, gtMd, renderHeaderTitle, renderHeaderLeft]);

  const renderTokenList = useMemo(() => {
    if (isPerps) {
      return <PerpsTokenListSection tokenListId={tokenListId} />;
    }
    // Native mobile: use FlatList + TokenListItem to match watchlist layout
    if (platformEnv.isNative && !gtMd) {
      if (tickerIsLoading && transformedData.length === 0) {
        return (
          <Stack flex={1}>
            <MarketListColumnHeader />
            <TokenListSkeleton count={15} />
          </Stack>
        );
      }
      return (
        <Stack flex={1}>
          <MarketListColumnHeader />
          <FlatList<IMarketToken>
            style={{ flex: 1 }}
            data={transformedData}
            renderItem={renderBannerItem}
            keyExtractor={bannerKeyExtractor}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            contentContainerStyle={{ paddingBottom: tabBarHeight }}
            ListEmptyComponent={
              <Stack
                flex={1}
                alignItems="center"
                justifyContent="center"
                p="$8"
              >
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_no_data })}
                </SizableText>
              </Stack>
            }
            ListFooterComponent={
              transformedData.length > 0 ? <ListEndIndicator /> : null
            }
          />
        </Stack>
      );
    }

    const tokenList = (
      <MarketTokenListBase
        result={listResult}
        onItemPress={handleItemPress}
        hideTokenAge
        clientSort
        watchlistFrom={EWatchlistFrom.BannerList}
        copyFrom={ECopyFrom.BannerList}
        showEndReachedIndicator
      />
    );
    if (platformEnv.isNative) {
      return tokenList;
    }
    return (
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{ overflowX: 'auto', overflowY: 'hidden' }}
      >
        <Stack flex={1} minWidth={900}>
          {tokenList}
        </Stack>
      </Stack>
    );
  }, [
    isPerps,
    tokenListId,
    listResult,
    handleItemPress,
    gtMd,
    tickerIsLoading,
    transformedData,
    renderBannerItem,
    bannerKeyExtractor,
    tabBarHeight,
    intl,
  ]);

  return (
    <Page>
      {renderPageHeader}
      <Page.Body>
        <Stack flex={1} pt={gtMd ? 0 : top} px={gtMd ? '$4' : 0} gap="$4">
          {renderTitleSection}
          {renderTokenList}
        </Stack>
      </Page.Body>
    </Page>
  );
}

export function MarketBannerDetail() {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { title } = route.params;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <MarketBannerDetailContent title={title} />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}
