import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

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
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketCategoryItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { isMarketStockCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import { useMarketTokenSelectorConfigAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { useMarketDetailHeaderDisplayData } from '../../hooks/useMarketDetailDisplayData';
import { buildMarketTokenDetailPreview } from '../../utils/marketDetailPreview';

import { ALL_NETWORK_ID, TOKEN_SELECTOR_POLLING_INTERVAL } from './constants';
import { MarketStockSelectorList } from './MarketStockSelectorList';
import { MarketTokenSelectorList } from './MarketTokenSelectorList';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

type IMarketTokenSelectorItem = IMarketToken & {
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

type IMarketTokenSelectorDefaultCategory = 'trending' | 'stocks';

function normalizeRouteBooleanParam(value: boolean | string | undefined) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value;
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
  const routeParams = route.params as
    | { showFavoriteButton?: boolean | string }
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
      return apiSpotCategories.map((c) => ({
        id: c.type,
        name: c.name,
      }));
    }
    if (defaultCategory === 'stocks') {
      return [
        {
          id: 'stocks',
          name: intl.formatMessage({
            id: ETranslations.perps_token_selector_stocks,
          }),
        },
      ];
    }
    // Fallback before API responds — use i18n keys
    return [
      {
        id: 'trending',
        name: intl.formatMessage({ id: ETranslations.dexmarket_trending }),
      },
    ];
  }, [apiSpotCategories, defaultCategory, intl]);

  const stockCategoryId = useMemo(
    () => categories.find((category) => isMarketStockCategory(category))?.id,
    [categories],
  );
  const shouldDefaultToStocks = defaultCategory === 'stocks';
  const [startListSelect, setStartListSelect] = useState(
    shouldDefaultToStocks ? false : isWatchlistMode,
  );
  const [selectedCategory, setSelectedCategory] = useState(
    shouldDefaultToStocks && stockCategoryId ? stockCategoryId : 'trending',
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
      });
    },
    [tokenDetailActions, closePopover, navigateToPerps, showFavoriteButton],
  );

  const handleSelectToken = useCallback(
    (item: IMarketTokenSelectorItem) => {
      navigateToTokenDetail({
        ...item,
        tokenDetailPreview:
          item.tokenDetailPreview ?? buildMarketTokenDetailPreview(item),
      });
    },
    [navigateToTokenDetail],
  );

  const handleSelectStock = useCallback(
    (stockId: string) => {
      void closePopover?.();
      void toMarketStockDetailPage(stockId);
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
            timeRange="1h"
            onItemPress={handleSelectToken}
            pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
            isWatchlistMode={Boolean(!searchValueDebounce && startListSelect)}
            searchQuery={searchValueDebounce}
            searchLoading={searchLoading}
            searchResults={searchTokenList}
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
  variant = 'default',
  defaultCategory = 'trending',
  renderTrigger,
}: {
  showAddress?: boolean;
  variant?: 'default' | 'compact';
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
    address = '',
    logoUrl = '',
    logoUrls,
  } = tokenDetail || {};
  const isCompact = variant === 'compact';
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
              gap="$2"
              alignItems="center"
              cursor="pointer"
              bg="$bgApp"
              pl={isCompact ? '$1' : '$2'}
              pr={isCompact ? '$0' : '$2'}
              py="$1.5"
              borderRadius="$full"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <Token
                size={isCompact ? 'sm' : 'md'}
                tokenImageUri={logoUrl}
                tokenImageUris={stableLogoUrls}
                networkImageUri={effectiveNetworkLogoUri}
                fallbackIcon="CryptoCoinOutline"
              />
              {showAddress ? (
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
                  {address ? (
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
              ) : (
                <>
                  <SizableText
                    size={isCompact ? '$headingMd' : '$heading2xl'}
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
      logoUrl,
      renderTrigger,
      renderSelectorContent,
      showAddress,
      stableLogoUrls,
      symbol,
    ],
  );

  return content;
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
