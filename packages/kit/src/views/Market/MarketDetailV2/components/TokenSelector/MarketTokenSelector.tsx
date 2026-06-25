import { memo, useCallback, useMemo, useRef, useState } from 'react';

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
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketCategoryItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import { useMarketTokenSelectorConfigAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ALL_NETWORK_ID, TOKEN_SELECTOR_POLLING_INTERVAL } from './constants';
import { MarketTokenSelectorList } from './MarketTokenSelectorList';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';

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

function BaseMarketTokenSelectorContent() {
  const intl = useIntl();
  const route = useRoute();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();
  const routeParams = route.params as
    | { showFavoriteButton?: boolean | string }
    | undefined;
  const showFavoriteButton = normalizeRouteBooleanParam(
    routeParams?.showFavoriteButton,
  );

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode } = selectorConfig;

  const [startListSelect, setStartListSelect] = useState(isWatchlistMode);
  const [selectedCategory, setSelectedCategory] = useState('trending');

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
    // Fallback before API responds — use i18n keys
    return [
      {
        id: 'trending',
        name: intl.formatMessage({ id: ETranslations.dexmarket_trending }),
      },
    ];
  }, [apiSpotCategories, intl]);

  const [searchValue, setSearchValue] = useState('');
  const searchValueDebounce = useDebounce(searchValue, 500);
  const { searchLoading, searchTokenList } =
    useSwapProTokenSearch(searchValueDebounce);

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
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
      });
    },
    [tokenDetailActions, closePopover, navigateToPerps, showFavoriteButton],
  );

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
      navigateToTokenDetail(item);
    },
    [navigateToTokenDetail],
  );

  return (
    <YStack>
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
      </YStack>
    </YStack>
  );
}

// Only render content when open to avoid stale state on reopen
function MarketTokenSelectorContent({ isOpen }: { isOpen: boolean }) {
  return isOpen ? <BaseMarketTokenSelectorContent /> : null;
}

const MarketTokenSelectorContentMemo = memo(MarketTokenSelectorContent);

function BaseMarketTokenSelector() {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { tokenDetail, networkId } = useTokenDetail();

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId,
  });

  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};
  const logoUrlsCacheKey = useMemo(() => logoUrls?.join('|') ?? '', [logoUrls]);
  const stableLogoUrlsRef = useRef(logoUrls);
  const stableLogoUrlsKeyRef = useRef(logoUrlsCacheKey);

  if (stableLogoUrlsKeyRef.current !== logoUrlsCacheKey) {
    stableLogoUrlsRef.current = logoUrls;
    stableLogoUrlsKeyRef.current = logoUrlsCacheKey;
  }

  const stableLogoUrls = stableLogoUrlsRef.current;

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
          // eslint-disable-next-line props-checker/validator -- Popover injects the trigger press handler.
          <XStack
            gap="$2"
            alignItems="center"
            cursor="pointer"
            bg="$bgApp"
            px="$2"
            py="$1.5"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
          >
            <Token
              size="md"
              tokenImageUri={logoUrl}
              tokenImageUris={stableLogoUrls}
              networkImageUri={effectiveNetworkLogoUri}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText
              size="$heading2xl"
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
        }
        renderContent={({ isOpen: isOpenProp }) => (
          <MarketTokenSelectorContentMemo isOpen={isOpenProp ?? false} />
        )}
      />
    ),
    [isOpen, symbol, logoUrl, stableLogoUrls, effectiveNetworkLogoUri, intl],
  );

  return content;
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
