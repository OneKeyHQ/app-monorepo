import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIntl } from 'react-intl';

import {
  NavBackButton,
  Page,
  SizableText,
  Stack,
  Tabs,
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
import {
  getStockPeRatioValue,
  shouldUseStockMetadataColumnsForTokens,
} from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS } from '../MarketHomeV2/utils';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../testIDs';
import {
  isMarketIndexQuoteBanner,
  isMarketMixedBanner,
} from '../utils/marketBannerUtils';

import { BannerDetailTokenFlatList } from './BannerDetailTokenFlatList';
import { PerpsTokenListSection } from './PerpsTokenListSection';
import { useMarketBannerDetail } from './useMarketBannerDetail';

import type { IMarketToken } from '../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type {
  EModalMarketRoutes,
  IModalMarketParamList,
} from '../router/types';
import type { RouteProp } from '@react-navigation/core';

type IMarketBannerDetailRouteParams = RouteProp<
  ITabMarketParamList & IModalMarketParamList,
  ETabMarketRoutes.MarketBannerDetail | EModalMarketRoutes.MarketBannerDetail
>;

// Stock metadata uses the liquidity column for volume, so only token lists hide it.
const BANNER_DETAIL_HIDDEN_DESKTOP_COLUMNS = ['liquidity'] as const;

function MarketBannerDetailContent({ title }: { title: string }) {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { tokenListId, type, assetType } = route.params;
  const isPerps = type === EMarketBannerType.Perps;
  const isMixed = isMarketMixedBanner(type);
  const [activeTab, setActiveTab] = useState<'spot' | 'perps'>('spot');
  const showPerps = isPerps || (isMixed && activeTab === 'perps');
  const handleTabPress = useCallback((name: string) => {
    if (name === 'spot' || name === 'perps') setActiveTab(name);
  }, []);
  const isIndex = isMarketIndexQuoteBanner({ type, assetType });
  const isStock =
    type === EMarketBannerType.Stock ||
    isMixed ||
    assetType === 'stock' ||
    assetType === 'etf' ||
    assetType === 'index';

  const intl = useIntl();
  const toDetailPage = useToDetailPage({ from: EEnterWay.BannerList });
  const { handleBackPress } = useMarketDetailBackNavigation();
  const { top } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { gtMd } = useMedia();

  const isWebDesktop = (platformEnv.isWeb || platformEnv.isDesktop) && gtMd;
  const {
    changeSortType,
    handleChangeSortPress,
    listResult,
    mobileData,
    tickerIsLoading,
  } = useMarketBannerDetail({ tokenListId, isPerps, isStock, isIndex });
  const useStockColumns = shouldUseStockMetadataColumnsForTokens(
    listResult.data,
    { forceStockMetadataColumns: isStock },
  );
  const hiddenDesktopColumns = useMemo(() => {
    if (!useStockColumns) return BANNER_DETAIL_HIDDEN_DESKTOP_COLUMNS;
    const hasPeRatio = listResult.data.some(
      (item) => getStockPeRatioValue(item) !== undefined,
    );
    // The turnover column renders P/E in stock metadata mode.
    return hasPeRatio
      ? COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS
      : ([...COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS, 'turnover'] as const);
  }, [listResult.data, useStockColumns]);

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
        ...item,
        tokenAddress: item.address,
        networkId: item.networkId,
        symbol: item.symbol,
        isNative: item.isNative,
      });
    },
    [toDetailPage],
  );
  const handleIndexItemPress = useCallback(() => undefined, []);
  const onItemPress = isIndex ? handleIndexItemPress : handleItemPress;

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
    // iOS 26 mobile uses the native UINavigationBar so the header gets
    // Liquid Glass material and the system back chevron. Don't pass
    // headerLeft — HeaderScreenOptions wires the system back button.
    // headerShown is set explicitly because this route can also be
    // reached as a modal (EModalMarketRoutes.MarketBannerDetail) where
    // the modal-stack's screenOptions default to headerShown:false; the
    // explicit prop ensures the bar renders in both navigation contexts.
    // Notification icon is intentionally omitted — it belongs to the
    // tab-level chrome (Market tab home), not to a banner detail page.
    if (platformEnv.isNativeIOS26Plus) {
      return <Page.Header headerShown headerTitle={renderHeaderTitle} />;
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
    // On iOS 26 mobile the title is in the native bar already.
    if (!gtMd && !platformEnv.isNativeIOS26Plus) {
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
    if (showPerps) {
      return (
        <PerpsTokenListSection
          tokenListId={tokenListId}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onChangeSortPress={handleChangeSortPress}
        />
      );
    }
    // Narrow layouts use the compact list to avoid the desktop table's
    // intrinsic width overflowing the viewport.
    if (!gtMd) {
      return (
        <BannerDetailTokenFlatList
          data={mobileData}
          isLoading={tickerIsLoading}
          primaryColumnTitle={
            useStockColumns
              ? intl.formatMessage({ id: ETranslations.market_stock_company })
              : `${intl.formatMessage({ id: ETranslations.global_name })} / ${intl.formatMessage({ id: ETranslations.market_mcap })}`
          }
          showMarketCap={!useStockColumns}
          showVolume={!useStockColumns}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onChangeSortPress={handleChangeSortPress}
          onItemPress={onItemPress}
        />
      );
    }

    const tokenList = (
      <MarketTokenListBase
        result={listResult}
        onItemPress={onItemPress}
        hideTokenAge
        clientSort
        watchlistFrom={EWatchlistFrom.BannerList}
        copyFrom={ECopyFrom.BannerList}
        change24hColumnTitle={change24hColumnTitle}
        showStockSubtitle={useStockColumns ? 'auto' : true}
        forceStockMetadataColumns={useStockColumns}
        hiddenDesktopColumns={hiddenDesktopColumns}
      />
    );
    return platformEnv.isNative ? (
      tokenList
    ) : (
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
    showPerps,
    useStockColumns,
    hiddenDesktopColumns,
    tokenListId,
    listResult,
    onItemPress,
    gtMd,
    tickerIsLoading,
    mobileData,
    changeSortType,
    handleChangeSortPress,
    intl,
  ]);

  let bodyTopInset: number;
  if (gtMd) {
    bodyTopInset = 0;
  } else if (platformEnv.isNativeIOS26Plus) {
    bodyTopInset = headerHeight;
  } else {
    bodyTopInset = top;
  }

  return (
    <Page>
      {renderPageHeader}
      <Page.Body>
        <Stack flex={1} pt={bodyTopInset} px={gtMd ? '$4' : 0} gap="$4">
          {renderTitleSection}
          {isMixed ? (
            <XStack role="tablist" px={gtMd ? '$2' : '$4'} gap="$5">
              {(['spot', 'perps'] as const).map((name) => (
                <Tabs.TabBarItem
                  key={name}
                  name={name}
                  label={intl.formatMessage({
                    id:
                      name === 'spot'
                        ? ETranslations.dexmarket_spot
                        : ETranslations.global_perp,
                  })}
                  isFocused={activeTab === name}
                  onPress={handleTabPress}
                  testID={`market-banner-detail-tab-${name}`}
                  tabItemStyle={{
                    ml: 0,
                    role: 'tab',
                    'aria-selected': activeTab === name,
                  }}
                />
              ))}
            </XStack>
          ) : null}
          {renderTokenList}
        </Stack>
      </Page.Body>
    </Page>
  );
}

export function MarketBannerDetail() {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { title, tokenListId, type, assetType } = route.params;

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
        <MarketBannerDetailContent
          key={`${tokenListId}:${type ?? ''}:${assetType ?? ''}`}
          title={title}
        />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}
