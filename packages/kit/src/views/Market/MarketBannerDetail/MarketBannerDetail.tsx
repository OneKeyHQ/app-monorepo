import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  NavBackButton,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { HeaderNotificationIconButton } from '@onekeyhq/kit/src/components/TabPageHeader/components/HeaderNotificationIconButton';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ECopyFrom,
  EEnterWay,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useMarketDetailBackNavigation } from '../MarketDetailV2/hooks/useMarketDetailBackNavigation';
import { useToDetailPage } from '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { MarketTokenListBase } from '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import {
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import type { IMarketToken } from '../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { EModalMarketRoutes, IModalMarketParamList } from '../router';
import type { RouteProp } from '@react-navigation/core';

type IMarketBannerDetailRouteParams = RouteProp<
  ITabMarketParamList & IModalMarketParamList,
  ETabMarketRoutes.MarketBannerDetail | EModalMarketRoutes.MarketBannerDetail
>;

function MarketBannerDetailContent({ title }: { title: string }) {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { tokenListId } = route.params;
  const toDetailPage = useToDetailPage({ from: EEnterWay.BannerList });
  const { handleBackPress } = useMarketDetailBackNavigation();
  const { top } = useSafeAreaInsets();
  const { gtMd } = useMedia();

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

  const renderUniversalSearchInput = useCallback(
    () => <UniversalSearchInput />,
    [],
  );

  const renderNotificationButton = useCallback(
    () => (
      <HeaderButtonGroup>
        <HeaderNotificationIconButton testID="market-banner-detail-notification" />
      </HeaderButtonGroup>
    ),
    [],
  );

  const { result, isLoading } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerTokenList({
          tokenListId,
        });
      return data;
    },
    [tokenListId],
    {
      watchLoading: true,
    },
  );

  const transformedData = useMemo(() => {
    if (!result) return [];
    return result.map((item, index) => {
      const chainId = item.networkId || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
        sortIndex: index,
      });
    });
  }, [result]);

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

  const listResult = useMemo(
    () => ({
      data: transformedData,
      isLoading,
      setSortBy: () => {},
      setSortType: () => {},
    }),
    [transformedData, isLoading],
  );

  const renderPageHeader = useMemo(() => {
    if (isWebDesktop) {
      return (
        <Page.Header
          headerTitleAlign="center"
          headerTitle={renderUniversalSearchInput}
          headerLeft={renderHeaderLeft}
          headerRight={renderNotificationButton}
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
    return null;
  }, [
    isWebDesktop,
    gtMd,
    renderUniversalSearchInput,
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

  return (
    <Page>
      {renderPageHeader}
      <Page.Body>
        <Stack flex={1} pt={gtMd ? 0 : top} px={gtMd ? '$4' : 0} gap="$4">
          {renderTitleSection}
          <MarketTokenListBase
            result={listResult}
            onItemPress={handleItemPress}
            hideTokenAge
            watchlistFrom={EWatchlistFrom.BannerList}
            copyFrom={ECopyFrom.BannerList}
            showEndReachedIndicator
          />
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
