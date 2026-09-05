import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactElement } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SearchBar,
  SizableText,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenSize } from '@onekeyhq/kit/src/components/Token';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { useMarketTopCoins } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTopCoinsList/hooks/useMarketTopCoins';
import type {
  IMarketCategoryItem,
  IMarketTimeRangeValue,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import {
  ensureMarketTopCoinsCategory,
  isMarketStockCategory,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import { useMarketTokenSelectorConfigAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockPublicItem,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { useMarketDetailHeaderDisplayData } from '../../hooks/useMarketDetailDisplayData';
import { buildMarketTokenDetailPreview } from '../../utils/marketDetailPreview';

import { ALL_NETWORK_ID, TOKEN_SELECTOR_POLLING_INTERVAL } from './constants';
import { MarketStockSelectorList } from './MarketStockSelectorList';
import { MarketTokenSelectorList } from './MarketTokenSelectorList';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

type IMarketTokenSelectorItem = IMarketToken & {
  marketAssetId?: string;
  selectorSubtitle?: string;
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

type IMarketTokenSelectorDefaultCategory = 'trending' | 'top_coins' | 'stocks';

function normalizeRouteBooleanParam(value: boolean | string | undefined) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value;
}

function toFiniteNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function convertTopCoinToSelectorToken(
  item: IMarketAssetListItem,
): IMarketTokenSelectorItem {
  return {
    id: `market_asset_${item.assetId}`,
    marketAssetId: item.assetId,
    name: item.symbol.toUpperCase(),
    symbol: item.symbol.toUpperCase(),
    address: '',
    decimals: 0,
    price: toFiniteNumber(item.price),
    change24h: toFiniteNumber(item.priceChange24hPercent),
    priceChangeRaw: item.priceChange24hPercent,
    marketCap: toFiniteNumber(item.marketCap),
    liquidity: 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: toFiniteNumber(item.volume24h),
    tokenImageUri: item.logoUrl,
    networkLogoUri: '',
    networkId: '',
    chainId: '',
    selectorSubtitle: item.symbol.toUpperCase(),
  };
}

// Reuse perps-style underline tab
const SelectorTabItem = memo(
  ({
    id,
    name,
    isFocused,
    onPress,
  }: {
    id: string;
    name: string;
    isFocused: boolean;
    onPress: (id: string) => void;
  }) => {
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    return (
      <XStack
        testID={`market-token-selector-tab-${id}`}
        py="$3"
        ml="$4"
        mr="$2"
        borderBottomWidth={isFocused ? '$0.5' : '$0'}
        borderBottomColor="$borderActive"
        onPress={handlePress}
        cursor="default"
      >
        <SizableText
          size="$headingXs"
          textTransform="none"
          letterSpacing={0}
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
SelectorTabItem.displayName = 'SelectorTabItem';

function BaseMarketTokenSelectorContent({
  defaultCategory,
}: {
  defaultCategory: IMarketTokenSelectorDefaultCategory;
}) {
  const intl = useIntl();
  const route = useRoute();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();
  const toMarketStockDetailPage = useToMarketStockDetailPage();
  const {
    data: topCoins,
    handleItemPress: handleTopCoinPress,
    isLoading: isTopCoinsLoading,
  } = useMarketTopCoins({ replaceCurrentDetail: true });
  const routeParams = route.params as
    | {
        showFavoriteButton?: boolean | string;
        marketTokenCategory?: string;
      }
    | undefined;
  const showFavoriteButton = normalizeRouteBooleanParam(
    routeParams?.showFavoriteButton,
  );

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode } = selectorConfig;

  const allNetworkId = ALL_NETWORK_ID;

  // Get spot categories from API
  const { spotCategories: apiSpotCategories } = useMarketBasicConfig();

  const categories: IMarketCategoryItem[] = useMemo(() => {
    if (apiSpotCategories.length > 0) {
      return ensureMarketTopCoinsCategory(
        apiSpotCategories.map((c) => ({
          id: c.type,
          name: c.name,
        })),
        intl.formatMessage({ id: ETranslations.market_top_coins }),
      );
    }
    // Keep the complete selector available while the remote config loads.
    return ensureMarketTopCoinsCategory(
      [
        {
          id: 'trending',
          name: intl.formatMessage({ id: ETranslations.dexmarket_trending }),
        },
        {
          id: 'stocks',
          name: intl.formatMessage({
            id: ETranslations.perps_token_selector_stocks,
          }),
        },
      ],
      intl.formatMessage({ id: ETranslations.market_top_coins }),
    );
  }, [apiSpotCategories, intl]);

  const stockCategoryId = useMemo(
    () => categories.find((category) => isMarketStockCategory(category))?.id,
    [categories],
  );
  const shouldDefaultToStocks = defaultCategory === 'stocks';
  const [startListSelect, setStartListSelect] = useState(
    shouldDefaultToStocks ? false : isWatchlistMode,
  );
  const routeCategory = routeParams?.marketTokenCategory;
  const initialCategory = shouldDefaultToStocks
    ? stockCategoryId
    : routeCategory || defaultCategory;
  const [selectedCategory, setSelectedCategory] = useState(
    initialCategory || 'trending',
  );
  const hasUserSelectedTabRef = useRef(false);

  useEffect(() => {
    if (
      !shouldDefaultToStocks ||
      !stockCategoryId ||
      hasUserSelectedTabRef.current
    ) {
      return;
    }
    setStartListSelect(false);
    setSelectedCategory(stockCategoryId);
  }, [shouldDefaultToStocks, stockCategoryId]);

  const isStockSelection = Boolean(
    !startListSelect && stockCategoryId && selectedCategory === stockCategoryId,
  );
  const isTopCoinsSelection = Boolean(
    !startListSelect && selectedCategory === MARKET_TOP_COINS_CATEGORY_ID,
  );
  const topCoinsSelectorData = useMemo(
    () => topCoins.map(convertTopCoinToSelectorToken),
    [topCoins],
  );
  const topCoinsById = useMemo(
    () => new Map(topCoins.map((item) => [item.assetId, item])),
    [topCoins],
  );

  // Trending reads the 1h metrics the v2 list can request server-side; top
  // coins and favorites are 24h data sets fetched through their own paths.
  const selectorTimeRange: IMarketTimeRangeValue =
    startListSelect || isTopCoinsSelection ? '24h' : '1h';

  const [searchValue, setSearchValue] = useState('');
  const searchValueDebounce = useDebounce(searchValue, 500);
  const { searchLoading, searchTokenList } = useSwapProTokenSearch(
    isStockSelection ? '' : searchValueDebounce,
  );

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      hasUserSelectedTabRef.current = true;
      setStartListSelect(false);
      setSelectedCategory(categoryId);
      setSelectorConfig((prev) => ({
        ...prev,
        isWatchlistMode: false,
      }));
    },
    [setSelectorConfig],
  );

  const handleStartListSelect = useCallback(
    (_id: string) => {
      hasUserSelectedTabRef.current = true;
      setStartListSelect(true);
      setSelectorConfig((prev) => ({ ...prev, isWatchlistMode: true }));
    },
    [setSelectorConfig],
  );

  const navigateToTokenDetail = useCallback(
    (token: {
      address: string;
      networkId: string;
      isNative?: boolean;
      perpsCoin?: string;
      tokenDetailPreview?: IMarketTokenDetailPreview;
    }) => {
      if (token.perpsCoin) {
        void closePopover?.();
        navigateToPerps(token.perpsCoin);
        return;
      }

      navigateToMarketTokenDetail(token, {
        tokenDetailActions,
        beforeNavigate: () => void closePopover?.(),
        showFavoriteButton,
        tokenDetailPreview: token.tokenDetailPreview,
        marketTokenCategory:
          startListSelect || searchValueDebounce ? undefined : selectedCategory,
      });
    },
    [
      tokenDetailActions,
      closePopover,
      navigateToPerps,
      searchValueDebounce,
      selectedCategory,
      showFavoriteButton,
      startListSelect,
    ],
  );

  const handleSelectToken = useCallback(
    (item: IMarketTokenSelectorItem) => {
      if (isTopCoinsSelection && !searchValueDebounce) {
        const topCoin = item.marketAssetId
          ? topCoinsById.get(item.marketAssetId)
          : undefined;
        if (topCoin) {
          void closePopover?.();
          void handleTopCoinPress(topCoin);
          return;
        }
      }
      navigateToTokenDetail({
        ...item,
        tokenDetailPreview:
          item.tokenDetailPreview ?? buildMarketTokenDetailPreview(item),
      });
    },
    [
      closePopover,
      handleTopCoinPress,
      isTopCoinsSelection,
      navigateToTokenDetail,
      searchValueDebounce,
      topCoinsById,
    ],
  );

  const handleSelectStock = useCallback(
    (stock: IMarketStockPublicItem) => {
      void closePopover?.();
      void toMarketStockDetailPage(stock);
    },
    [closePopover, toMarketStockDetailPage],
  );

  return (
    <YStack testID="market-token-selector-content">
      <YStack gap="$1">
        <XStack px="$2" pt="$2">
          <SearchBar
            containerProps={{
              borderRadius: '$2',
              mx: '$2',
              mt: '$2',
              flex: 1,
            }}
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            value={searchValue}
            onChangeText={setSearchValue}
          />
        </XStack>

        {/* Tabs - hidden during search */}
        {searchValueDebounce ? null : (
          <XStack
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            bg="$bg"
            px="$0"
          >
            <SelectorTabItem
              id="favorites"
              name={intl.formatMessage({
                id: ETranslations.global_favorites,
              })}
              isFocused={startListSelect}
              onPress={handleStartListSelect}
            />
            {categories.map((item) => (
              <SelectorTabItem
                key={item.id}
                id={item.id}
                name={item.name}
                isFocused={Boolean(
                  !startListSelect && item.id === selectedCategory,
                )}
                onPress={handleCategoryChange}
              />
            ))}
          </XStack>
        )}

        {/* List content */}
        {isStockSelection ? (
          <MarketStockSelectorList
            query={searchValueDebounce}
            onItemPress={handleSelectStock}
          />
        ) : (
          <MarketTokenSelectorList
            networkId={allNetworkId}
            selectedCategory={selectedCategory}
            timeRange={selectorTimeRange}
            onItemPress={handleSelectToken}
            pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
            isWatchlistMode={Boolean(!searchValueDebounce && startListSelect)}
            searchQuery={searchValueDebounce}
            searchLoading={searchLoading}
            searchResults={searchTokenList}
            dataOverride={
              isTopCoinsSelection && !searchValueDebounce
                ? topCoinsSelectorData
                : undefined
            }
            dataOverrideLoading={isTopCoinsLoading}
          />
        )}
      </YStack>
    </YStack>
  );
}

// Only render content when open to avoid stale state on reopen
function MarketTokenSelectorContent({
  isOpen,
  defaultCategory,
}: {
  isOpen: boolean;
  defaultCategory: IMarketTokenSelectorDefaultCategory;
}) {
  return isOpen ? (
    <BaseMarketTokenSelectorContent defaultCategory={defaultCategory} />
  ) : null;
}

const MarketTokenSelectorContentMemo = memo(MarketTokenSelectorContent);

function BaseMarketTokenSelector({
  showAddress = false,
  showName = false,
  variant = 'default',
  defaultCategory = 'trending',
  renderTrigger,
}: {
  showAddress?: boolean;
  showName?: boolean;
  variant?: 'default' | 'compact' | 'large';
  defaultCategory?: IMarketTokenSelectorDefaultCategory;
  renderTrigger?: ReactElement;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { tokenDetail, networkId } = useMarketDetailHeaderDisplayData();

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId,
  });

  const {
    symbol = '',
    name = '',
    address = '',
    logoUrl = '',
    logoUrls,
  } = tokenDetail || {};
  const isCompact = variant === 'compact';
  const isLarge = variant === 'large';
  let triggerPaddingLeft: ComponentProps<typeof XStack>['pl'] = '$2';
  let triggerPaddingRight: ComponentProps<typeof XStack>['pr'] = '$2';
  let triggerPaddingVertical: ComponentProps<typeof XStack>['py'] = '$1.5';
  let triggerGap: ComponentProps<typeof XStack>['gap'] = '$2';
  let triggerTokenSize: ITokenSize = 'md';
  let triggerTextSize: ComponentProps<typeof SizableText>['size'] =
    '$heading2xl';
  // Figma 25705:19982 — the name-carrying trigger is the same pill the stock
  // detail header uses: token, stacked ticker/name, then the chevron closing
  // the pill. The hover background reaches 8px past the content horizontally
  // and 4px vertically, and every negative margin is cancelled by a matching
  // padding so the row itself never moves.
  const isLargeWithName = isLarge && showName;
  let triggerMarginHorizontal: ComponentProps<typeof XStack>['mx'];
  let triggerMarginVertical: ComponentProps<typeof XStack>['my'];
  if (isLarge) {
    triggerPaddingLeft = '$0';
    triggerPaddingRight = '$0';
    triggerPaddingVertical = '$0';
    triggerGap = 14;
    triggerTokenSize = 'xl';
    triggerTextSize = '$headingXl';
    if (isLargeWithName) {
      triggerMarginHorizontal = -8;
      triggerMarginVertical = -4;
      triggerPaddingLeft = 8;
      triggerPaddingRight = 8;
      triggerPaddingVertical = 4;
    }
  } else if (isCompact) {
    triggerPaddingLeft = '$1';
    triggerPaddingRight = '$0';
    triggerTokenSize = 'sm';
    triggerTextSize = '$headingMd';
  }
  const logoUrlsCacheKey = useMemo(() => logoUrls?.join('|') ?? '', [logoUrls]);
  const stableLogoUrlsRef = useRef(logoUrls);
  const stableLogoUrlsKeyRef = useRef(logoUrlsCacheKey);

  if (stableLogoUrlsKeyRef.current !== logoUrlsCacheKey) {
    stableLogoUrlsRef.current = logoUrls;
    stableLogoUrlsKeyRef.current = logoUrlsCacheKey;
  }

  const stableLogoUrls = stableLogoUrlsRef.current;

  const renderSelectorContent = useCallback(
    ({ isOpen: isOpenProp }: { isOpen?: boolean }) => (
      <MarketTokenSelectorContentMemo
        isOpen={isOpenProp ?? false}
        defaultCategory={defaultCategory}
      />
    ),
    [defaultCategory],
  );

  // Keep the popover element stable during token detail polling.
  // `logoUrls` is often returned as a fresh array on each refresh even when
  // the actual content is unchanged, which would otherwise recreate the
  // popover tree and cause visible jitter while it is open.
  const content = useMemo(
    () => (
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_search })}
        floatingPanelProps={{ width: 800 }}
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-start"
        renderTrigger={
          renderTrigger ?? (
            // eslint-disable-next-line props-checker/validator -- Popover injects the trigger press handler.
            <XStack
              testID="market-token-selector-trigger"
              alignItems="center"
              cursor="pointer"
              bg="$bgApp"
              mx={triggerMarginHorizontal}
              my={triggerMarginVertical}
              pl={triggerPaddingLeft}
              pr={triggerPaddingRight}
              py={triggerPaddingVertical}
              gap={triggerGap}
              borderRadius="$full"
              borderCurve="continuous"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <Token
                size={triggerTokenSize}
                tokenImageUri={logoUrl}
                tokenImageUris={stableLogoUrls}
                networkImageUri={effectiveNetworkLogoUri}
                fallbackIcon="CryptoCoinOutline"
              />
              {isLargeWithName ? (
                <>
                  <YStack minWidth={0} flexShrink={1} justifyContent="center">
                    <SizableText
                      size="$headingXl"
                      color="$text"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      maxWidth="$48"
                      flexShrink={1}
                    >
                      {symbol}
                    </SizableText>
                    {name ? (
                      <SizableText
                        size="$bodyMdMedium"
                        color="$textSubdued"
                        numberOfLines={1}
                      >
                        {name}
                      </SizableText>
                    ) : null}
                  </YStack>
                  <Icon
                    name="ChevronDownSmallOutline"
                    size="$5"
                    color="$iconSubdued"
                  />
                </>
              ) : null}
              {!isLargeWithName && (showAddress || showName) ? (
                <YStack minWidth={0} flexShrink={1}>
                  <XStack alignItems="center" gap="$1">
                    <SizableText
                      size="$headingLg"
                      color="$text"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      maxWidth="$48"
                      flexShrink={1}
                    >
                      {symbol}
                    </SizableText>
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$5"
                      color="$iconSubdued"
                    />
                  </XStack>
                  {showName && name ? (
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      pr="$1"
                    >
                      {name}
                    </SizableText>
                  ) : null}
                  {!showName && showAddress && address ? (
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      pr="$1"
                    >
                      {accountUtils.shortenAddress({
                        address,
                        leadingLength: 6,
                        trailingLength: 4,
                      })}
                    </SizableText>
                  ) : null}
                </YStack>
              ) : null}
              {isLargeWithName || showAddress || showName ? null : (
                <>
                  <SizableText
                    size={triggerTextSize}
                    color="$text"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    maxWidth="$48"
                    flexShrink={1}
                  >
                    {symbol}
                  </SizableText>
                  <Icon
                    name="ChevronDownSmallOutline"
                    size={isCompact ? '$4.5' : '$5'}
                    color="$iconSubdued"
                  />
                </>
              )}
            </XStack>
          )
        }
        renderContent={renderSelectorContent}
      />
    ),
    [
      address,
      effectiveNetworkLogoUri,
      intl,
      isOpen,
      isCompact,
      isLargeWithName,
      logoUrl,
      renderTrigger,
      renderSelectorContent,
      showAddress,
      showName,
      stableLogoUrls,
      symbol,
      name,
      triggerGap,
      triggerMarginHorizontal,
      triggerMarginVertical,
      triggerPaddingLeft,
      triggerPaddingRight,
      triggerPaddingVertical,
      triggerTextSize,
      triggerTokenSize,
    ],
  );

  return content;
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
