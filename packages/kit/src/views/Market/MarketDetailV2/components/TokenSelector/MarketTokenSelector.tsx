import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
  usePopoverContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import {
  MarketNormalTokenList,
  MarketWatchlistTokenList,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import SwapProSearchTokenList from '@onekeyhq/kit/src/views/Swap/pages/components/SwapProSearchTokenList';
import { useMarketTokenSelectorConfigAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

const TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS = [
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
] as const;

function toFiniteNumber(value?: string | number) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

// ---------------------------------------------------------------------------
// Popover content — mirrors SwapProSelectTokenPage structure
// ---------------------------------------------------------------------------
function BaseMarketTokenSelectorContent() {
  const intl = useIntl();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();
  const { tokenDetail, networkId } = useTokenDetail();

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode, spotNetworkId } = selectorConfig;

  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(isWatchlistMode ? undefined : spotNetworkId || undefined);
  const [startListSelect, setStartListSelect] = useState(isWatchlistMode);

  // Search state (same as Swap Pro)
  const [searchValue, setSearchValue] = useState('');
  const searchValueDebounce = useDebounce(searchValue, 500);
  const { searchLoading, searchTokenList } = useSwapProTokenSearch(
    searchValueDebounce,
    selectedNetworkId,
  );

  const liveTokenOverride = useMemo(() => {
    if (!tokenDetail?.address || !networkId) {
      return undefined;
    }

    const buy24hCount = toFiniteNumber(tokenDetail.buy24hCount);
    const sell24hCount = toFiniteNumber(tokenDetail.sell24hCount);
    const walletInfo =
      buy24hCount !== undefined || sell24hCount !== undefined
        ? {
            buy: buy24hCount ?? 0,
            sell: sell24hCount ?? 0,
          }
        : undefined;

    return {
      networkId,
      address: tokenDetail.address,
      price: toFiniteNumber(tokenDetail.price),
      change24h: toFiniteNumber(tokenDetail.priceChange24hPercent),
      marketCap: toFiniteNumber(tokenDetail.marketCap),
      liquidity: toFiniteNumber(tokenDetail.liquidity),
      transactions: toFiniteNumber(tokenDetail.trade24hCount),
      uniqueTraders: toFiniteNumber(tokenDetail.uniqueWallet24h),
      holders: tokenDetail.holders,
      turnover: toFiniteNumber(tokenDetail.volume24h),
      walletInfo,
    };
  }, [
    networkId,
    tokenDetail?.address,
    tokenDetail?.price,
    tokenDetail?.priceChange24hPercent,
    tokenDetail?.marketCap,
    tokenDetail?.liquidity,
    tokenDetail?.trade24hCount,
    tokenDetail?.uniqueWallet24h,
    tokenDetail?.holders,
    tokenDetail?.volume24h,
    tokenDetail?.buy24hCount,
    tokenDetail?.sell24hCount,
  ]);

  const handleNetworkIdChange = useCallback(
    (nextNetworkId: string) => {
      setStartListSelect(false);
      setSelectedNetworkId(nextNetworkId);
      setSelectorConfig((prev) => ({
        ...prev,
        isWatchlistMode: false,
        spotNetworkId: nextNetworkId,
      }));
    },
    [setSelectorConfig],
  );

  const handleStartListSelect = useCallback(() => {
    setStartListSelect(true);
    setSelectedNetworkId(undefined);
    setSelectorConfig((prev) => ({ ...prev, isWatchlistMode: true }));
  }, [setSelectorConfig]);

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
      if (item.perpsCoin) {
        void closePopover?.();
        navigateToPerps(item.perpsCoin);
        return;
      }

      const shortCode = networkUtils.getNetworkShortCode({
        networkId: item.networkId,
      });

      void tokenDetailActions.current.changeActiveToken({
        tokenAddress: item.address,
        networkId: item.networkId,
        isNative: item.isNative ?? false,
      });

      void closePopover?.();

      const targetTab = platformEnv.isNative
        ? ETabRoutes.Discovery
        : ETabRoutes.Market;
      const params = {
        tokenAddress: item.address,
        network: shortCode || item.networkId,
        isNative: item.isNative,
      };
      setTimeout(() => {
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: targetTab,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params,
          },
        });
      }, 100);
    },
    [tokenDetailActions, closePopover, navigateToPerps],
  );

  const handleSearchTokenSelect = useCallback(
    (token: IMarketSearchV2Token & { networkLogoURI: string }) => {
      const shortCode = networkUtils.getNetworkShortCode({
        networkId: token.network,
      });

      void tokenDetailActions.current.changeActiveToken({
        tokenAddress: token.address,
        networkId: token.network,
        isNative: token.isNative ?? false,
      });

      void closePopover?.();

      const targetTab = platformEnv.isNative
        ? ETabRoutes.Discovery
        : ETabRoutes.Market;
      const params = {
        tokenAddress: token.address,
        network: shortCode || token.network,
        isNative: token.isNative,
      };
      setTimeout(() => {
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: targetTab,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params,
          },
        });
      }, 100);
    },
    [tokenDetailActions, closePopover],
  );

  return (
    <YStack p="$3" gap="$1" height={500}>
      {/* Search */}
      <Stack px="$2" pb="$2">
        <SearchBar
          autoFocus
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_asset,
          })}
          value={searchValue}
          onChangeText={setSearchValue}
        />
      </Stack>

      {searchValueDebounce ? (
        <SwapProSearchTokenList
          isLoading={searchLoading}
          items={searchTokenList}
          onPress={handleSearchTokenSelect}
        />
      ) : (
        <>
          <MarketTokenListNetworkSelector
            selectedNetworkId={selectedNetworkId}
            onSelectNetworkId={handleNetworkIdChange}
            placement="bottom-start"
            startListSelect={startListSelect}
            onStartListSelect={handleStartListSelect}
          />

          {startListSelect ? (
            <MarketWatchlistTokenList
              onItemPress={handleSelectToken}
              hideNativeToken
              hidePerps
              hiddenDesktopColumns={TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS}
              liveTokenOverride={liveTokenOverride}
            />
          ) : (
            <MarketNormalTokenList
              onItemPress={handleSelectToken}
              networkId={selectedNetworkId}
              hiddenDesktopColumns={TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS}
              liveTokenOverride={liveTokenOverride}
            />
          )}
        </>
      )}
    </YStack>
  );
}

// Only render content when open (Perps pattern)
function MarketTokenSelectorContent({ isOpen }: { isOpen: boolean }) {
  return isOpen ? <BaseMarketTokenSelectorContent /> : null;
}

const MarketTokenSelectorContentMemo = memo(MarketTokenSelectorContent);

// ---------------------------------------------------------------------------
// Main Popover trigger — reads tokenDetail for display only
// ---------------------------------------------------------------------------
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
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
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
              maxWidth="$60"
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
