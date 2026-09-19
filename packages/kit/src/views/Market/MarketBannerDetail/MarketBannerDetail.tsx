import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIntl } from 'react-intl';

import {
  type ITabBarItemProps,
  type IXStackProps,
  type IYStackProps,
  NavBackButton,
  Page,
  SizableText,
  Stack,
  Tabs,
  XStack,
  YStack,
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
import {
  EMarketBannerType,
  type IMarketStockPublicItem,
} from '@onekeyhq/shared/types/marketV2';

import { TabPageHeader } from '../../../components/TabPageHeader';
import {
  MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  MARKET_DESKTOP_NO_TOOLBAR_TABLE_INSET,
  MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE,
  MARKET_DESKTOP_TOOLBAR_INSET,
} from '../marketDesktopLayoutConstants';
import { useMarketDetailBackNavigation } from '../MarketDetailV2/hooks/useMarketDetailBackNavigation';
import { useToDetailPage } from '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { MarketTokenListBase } from '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import {
  getStockPeRatioValue,
  shouldUseStockMetadataColumnsForTokens,
} from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import {
  COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS,
  MARKET_FIXED_24H_RANGE,
} from '../MarketHomeV2/utils';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../testIDs';
import {
  isMarketIndexQuoteBanner,
  isMarketMixedBanner,
  isMarketStockPerpsBanner,
} from '../utils/marketBannerUtils';

import {
  SCROLL_EDGE_EFFECTS_WITH_ELEMENT_CONTAINER,
  isScrollEdgeElementContainerSupported,
} from './BannerDetailMobileListFrame';
import { BannerDetailStockFlatList } from './BannerDetailStockFlatList';
import { BannerDetailStockTable } from './BannerDetailStockTable';
import { BannerDetailTokenFlatList } from './BannerDetailTokenFlatList';
import { PerpsTokenListSection } from './PerpsTokenListSection';
import { useMarketBannerDetail } from './useMarketBannerDetail';

import type { IBannerDetailHeaderOverlay } from './BannerDetailMobileListFrame';
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

function getBannerSpotTabLabelId(
  name: 'spot' | 'perps',
  isStock: boolean,
): ETranslations {
  if (name === 'perps') {
    return ETranslations.global_perp;
  }
  // Non-stock lists read as "Crypto", matching the Favorites filter.
  return isStock
    ? ETranslations.perps_token_selector_stocks
    : ETranslations.prime_crypto_payment__label;
}

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
    isMarketStockPerpsBanner(type) ||
    assetType === 'stock' ||
    assetType === 'etf' ||
    assetType === 'index';

  const intl = useIntl();
  const toDetailPage = useToDetailPage({ from: EEnterWay.BannerList });
  const { handleBackPress } = useMarketDetailBackNavigation();
  const { top } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { gtMd } = useMedia();
  // iOS 26 phones pin the tabs + column header into the bar's glass instead of
  // pushing the whole body below the bar (see BannerDetailMobileListFrame).
  const useGlassPinnedHeader = isScrollEdgeElementContainerSupported && !gtMd;

  const isWebDesktop = (platformEnv.isWeb || platformEnv.isDesktop) && gtMd;
  // Non-native wide layouts (web, Electron, extension expanded tab) mirror
  // the home page's DesktopLayout; the native tablet keeps the legacy table.
  const isDesktopTable = gtMd && !platformEnv.isNative;
  const {
    changeSortType,
    handleChangeSortPress,
    listResult,
    mobileData,
    stockItems,
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

  // Only the wide web/Electron title row keeps the large page title; every
  // other layout (narrow screens, native headers, iPad) uses the default
  // navigation header title size.
  const renderHeaderTitle = useCallback(
    () => (
      <SizableText
        size={isWebDesktop ? '$heading2xl' : '$headingLg'}
        numberOfLines={1}
        flexShrink={1}
      >
        {title}
      </SizableText>
    ),
    [isWebDesktop, title],
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
  const handleStockItemPress = useCallback(
    (item: IMarketStockPublicItem) => {
      // `toDetailPage` resolves the stock route from `stockId`, keeping the
      // BannerList enter way the page logs today.
      void toDetailPage({
        stockId: item.stockId,
        symbol: item.symbol,
        name: item.name,
        tokenAddress: '',
        networkId: '',
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
      return (
        <Page.Header
          headerShown
          headerTitle={renderHeaderTitle}
          {...(useGlassPinnedHeader
            ? { scrollEdgeEffects: SCROLL_EDGE_EFFECTS_WITH_ELEMENT_CONTAINER }
            : undefined)}
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
    useGlassPinnedHeader,
  ]);

  const renderTitleSection = useMemo(() => {
    if (isWebDesktop) {
      return (
        // The title lines up with the tab labels and the table's first-column
        // star glyph at the design's 20px inset.
        <XStack ai="center" px={MARKET_DESKTOP_TOOLBAR_INSET} pt="$6">
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

  // The desktop row mirrors the home page's tab bar: the active tab is marked
  // by label weight instead of an underline, and each item's own
  // `ml="$pagePadding"` owns both the 20px lead-in and the gap between labels,
  // so the row carries neither padding nor gap of its own.
  const tabListProps = useMemo<IXStackProps>(
    () =>
      isDesktopTable
        ? // The home tab bar disables text selection on its container, which
          // is what keeps the pointer from turning into the text cursor.
          { ...MARKET_DESKTOP_TAB_BAR_CONTAINER_STYLE, userSelect: 'none' }
        : { px: gtMd ? '$2' : '$4', gap: '$5' },
    [isDesktopTable, gtMd],
  );
  const tabItemBaseStyle = useMemo<IYStackProps>(
    () => (isDesktopTable ? { role: 'tab' } : { ml: 0, role: 'tab' }),
    [isDesktopTable],
  );
  const tabItemActiveProps = useMemo<
    Pick<ITabBarItemProps, 'focusedTextSize' | 'hideActiveIndicator'>
  >(
    () =>
      isDesktopTable
        ? { focusedTextSize: '$headingMd', hideActiveIndicator: true }
        : {},
    [isDesktopTable],
  );

  const mixedTabs = useMemo(
    () =>
      isMixed ? (
        <XStack role="tablist" {...tabListProps}>
          {(['spot', 'perps'] as const).map((name) => (
            <Tabs.TabBarItem
              key={name}
              name={name}
              label={intl.formatMessage({
                // The non-perps list of a mixed banner comes from the
                // stock endpoint, so its tab is labelled by what it shows.
                id: getBannerSpotTabLabelId(name, isStock),
              })}
              isFocused={activeTab === name}
              onPress={handleTabPress}
              testID={`market-banner-detail-tab-${name}`}
              {...tabItemActiveProps}
              tabItemStyle={{
                ...tabItemBaseStyle,
                'aria-selected': activeTab === name,
              }}
            />
          ))}
        </XStack>
      ) : null,
    [
      isMixed,
      tabListProps,
      intl,
      isStock,
      activeTab,
      handleTabPress,
      tabItemActiveProps,
      tabItemBaseStyle,
    ],
  );

  const headerOverlay = useMemo<IBannerDetailHeaderOverlay | undefined>(
    () =>
      useGlassPinnedHeader
        ? { topInset: headerHeight, prefix: mixedTabs }
        : undefined,
    [useGlassPinnedHeader, headerHeight, mixedTabs],
  );

  const renderTokenList = useMemo(() => {
    const change24hColumnTitle = intl.formatMessage({
      id: ETranslations.dexmarket_banner_token_24hchange,
    });
    if (showPerps) {
      const perpsSection = (
        <PerpsTokenListSection
          tokenListId={tokenListId}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onChangeSortPress={handleChangeSortPress}
          headerOverlay={headerOverlay}
        />
      );
      return isDesktopTable ? (
        <YStack px="$3" flex={1}>
          {perpsSection}
        </YStack>
      ) : (
        perpsSection
      );
    }
    // Narrow layouts use the mobile home lists' rows: the desktop table's
    // intrinsic width would overflow the viewport.
    if (!gtMd) {
      if (isStock) {
        return (
          <BannerDetailStockFlatList
            items={stockItems}
            isLoading={Boolean(tickerIsLoading)}
            changeSortType={changeSortType}
            onChangeSortPress={handleChangeSortPress}
            onItemPress={isIndex ? handleIndexItemPress : handleStockItemPress}
            headerOverlay={headerOverlay}
          />
        );
      }
      return (
        <BannerDetailTokenFlatList
          data={mobileData}
          isLoading={tickerIsLoading}
          changeSortType={changeSortType}
          change24hColumnTitle={change24hColumnTitle}
          onChangeSortPress={handleChangeSortPress}
          onItemPress={onItemPress}
          headerOverlay={headerOverlay}
        />
      );
    }

    if (isDesktopTable) {
      if (isStock) {
        return (
          <YStack flex={1} width="100%">
            <BannerDetailStockTable
              items={stockItems}
              isLoading={Boolean(tickerIsLoading)}
              onItemPress={
                isIndex ? handleIndexItemPress : handleStockItemPress
              }
            />
          </YStack>
        );
      }
      return (
        <YStack px="$3" flex={1}>
          <MarketTokenListBase
            result={{
              ...listResult,
              // Desktop sorts in memory through the trending header; the
              // persisted 24h-change sort belongs to the mobile list.
              currentSortBy: undefined,
              currentSortType: undefined,
            }}
            onItemPress={onItemPress}
            clientSort
            // The banner endpoint carries no `firstTradeTime`.
            hideTokenAge
            watchlistFrom={EWatchlistFrom.BannerList}
            copyFrom={ECopyFrom.BannerList}
            desktopColumnVariant="trending"
            timeRange={MARKET_FIXED_24H_RANGE}
          />
        </YStack>
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
    // Native tablet: the legacy table, without the web scroller.
    return tokenList;
  }, [
    showPerps,
    useStockColumns,
    hiddenDesktopColumns,
    tokenListId,
    listResult,
    onItemPress,
    gtMd,
    isDesktopTable,
    isStock,
    isIndex,
    stockItems,
    handleStockItemPress,
    handleIndexItemPress,
    tickerIsLoading,
    mobileData,
    changeSortType,
    handleChangeSortPress,
    intl,
    headerOverlay,
  ]);

  let bodyTopInset: number;
  if (gtMd || headerOverlay) {
    // The pinned list header owns the native header inset on iOS 26 phones.
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
        <Stack
          flex={1}
          pt={bodyTopInset}
          gap="$4"
          testID="market-banner-detail-body"
          {...(isDesktopTable
            ? MARKET_DESKTOP_CONTENT_FRAME_PROPS
            : { px: gtMd ? '$4' : 0 })}
        >
          {renderTitleSection}
          {/* On desktop the table sits the design's 12px below the tab row,
              as it does under the home tab bar on pages with no toolbar. */}
          <YStack
            flex={1}
            gap={isDesktopTable ? MARKET_DESKTOP_NO_TOOLBAR_TABLE_INSET : '$4'}
          >
            {headerOverlay ? null : mixedTabs}
            {renderTokenList}
          </YStack>
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
