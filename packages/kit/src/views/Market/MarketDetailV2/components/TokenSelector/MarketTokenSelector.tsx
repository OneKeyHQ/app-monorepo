import { memo, useCallback, useMemo, useState } from 'react';

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

// ---------------------------------------------------------------------------
// Popover content — mirrors SwapProSelectTokenPage structure
// ---------------------------------------------------------------------------
function BaseMarketTokenSelectorContent() {
  const intl = useIntl();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();

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

  const handleNetworkIdChange = useCallback(
    (networkId: string) => {
      setStartListSelect(false);
      setSelectedNetworkId(networkId);
      setSelectorConfig((prev) => ({
        ...prev,
        isWatchlistMode: false,
        spotNetworkId: networkId,
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
        closePopover?.();
        navigateToPerps(item.perpsCoin);
        return;
      }

      const shortCode = networkUtils.getNetworkShortCode({
        networkId: item.networkId,
      });

      tokenDetailActions.current.changeActiveToken({
        tokenAddress: item.address,
        networkId: item.networkId,
        isNative: item.isNative ?? false,
      });

      closePopover?.();

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
    (token: {
      network: string;
      address: string;
      decimals: number;
      symbol: string;
      logoUrl: string;
      name: string;
      isNative?: boolean;
      price?: number;
      networkLogoURI: string;
    }) => {
      const shortCode = networkUtils.getNetworkShortCode({
        networkId: token.network,
      });

      tokenDetailActions.current.changeActiveToken({
        tokenAddress: token.address,
        networkId: token.network,
        isNative: token.isNative ?? false,
      });

      closePopover?.();

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
            />
          ) : (
            <MarketNormalTokenList
              onItemPress={handleSelectToken}
              networkId={selectedNetworkId}
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

  // useMemo with ONLY display values as deps (Perps pattern)
  const content = useMemo(
    () => (
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_search })}
        floatingPanelProps={{ width: 800 }}
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-start"
        renderTrigger={
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
              tokenImageUris={logoUrls}
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
    [isOpen, symbol, logoUrl, logoUrls, effectiveNetworkLogoUri, intl],
  );

  return content;
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
