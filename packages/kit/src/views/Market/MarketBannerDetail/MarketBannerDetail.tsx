import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

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
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { HeaderNotificationIconButton } from '@onekeyhq/kit/src/components/TabPageHeader/components/HeaderNotificationIconButton';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { useToDetailPage } from '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { MarketTokenListBase } from '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../testIDs';

import { BannerDetailTokenFlatList } from './BannerDetailTokenFlatList';
import { PerpsTokenListSection } from './PerpsTokenListSection';
import { useMarketBannerDetail } from './useMarketBannerDetail';

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
  const { gtMd } = useMedia();

  const isWebDesktop = (platformEnv.isWeb || platformEnv.isDesktop) && gtMd;
  const {
    changeSortType,
    handleChangeSortPress,
    handlePriceSortPress,
    listResult,
    mobileData,
    priceSortType,
    tickerIsLoading,
  } = useMarketBannerDetail({ tokenListId, isPerps });

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
        <HeaderNotificationIconButton
          testID={MarketTestIDs.detailNotificationButton}
        />
      </HeaderButtonGroup>
    ),
    [],
  );

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
    const change24hColumnTitle = intl.formatMessage({
      id: ETranslations.dexmarket_banner_token_24hchange,
    });
    if (isPerps) {
      return (
        <PerpsTokenListSection
          tokenListId={tokenListId}
          priceSortType={priceSortType}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onPriceSortPress={handlePriceSortPress}
          onChangeSortPress={handleChangeSortPress}
        />
      );
    }
    // Native mobile: use FlatList + TokenListItem to match watchlist layout
    if (platformEnv.isNative && !gtMd) {
      return (
        <BannerDetailTokenFlatList
          data={mobileData}
          isLoading={tickerIsLoading}
          priceSortType={priceSortType}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onPriceSortPress={handlePriceSortPress}
          onChangeSortPress={handleChangeSortPress}
          onItemPress={handleItemPress}
        />
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
        change24hColumnTitle={change24hColumnTitle}
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
    mobileData,
    priceSortType,
    changeSortType,
    handlePriceSortPress,
    handleChangeSortPress,
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
