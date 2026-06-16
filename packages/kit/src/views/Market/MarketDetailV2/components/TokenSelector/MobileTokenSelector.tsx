import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Spinner, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import {
  MarketNormalTokenList,
  MarketWatchlistTokenList,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { isMarketStockCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import SwapProSearchTokenList from '@onekeyhq/kit/src/views/Swap/pages/components/SwapProSearchTokenList';
import {
  EJotaiContextStoreNames,
  useMarketTokenSelectorConfigAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ALL_NETWORK_ID,
  TOKEN_SELECTOR_POLLING_INTERVAL,
  convertSearchTokenToMarketToken,
} from './constants';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';
import { useLiveTokenOverride } from './useLiveTokenOverride';

import type { IMarketMobileTokenSelectorParams } from '../../../router';

function buildStockSwapTokenFromMarketToken(token: IMarketToken): ISwapToken {
  return {
    networkId: token.networkId,
    contractAddress: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.tokenImageUri,
    networkLogoURI: token.networkLogoUri,
    isNative: !!token.isNative,
    price: token.price ? token.price.toString() : undefined,
  };
}

function MobileTokenSelectorContent() {
  const intl = useIntl();
  const route = useRoute();
  const navigation = useAppNavigation();
  const tokenDetailActions = useTokenDetailActions();
  const { navigateToPerps } = usePerpsNavigation();
  const routeParams = route.params as
    | IMarketMobileTokenSelectorParams
    | undefined;
  const mode = routeParams?.mode ?? 'all';
  const selectTarget = routeParams?.selectTarget ?? 'marketDetail';
  const isStockMode = mode === 'stock';
  const isSwapStockSelectTarget = selectTarget === 'swapStock';
  const { spotCategories } = useMarketBasicConfig();

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode, spotNetworkId } = selectorConfig;

  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(isWatchlistMode ? undefined : spotNetworkId || undefined);
  const [startListSelect, setStartListSelect] = useState(isWatchlistMode);

  const [searchValue, setSearchValue] = useState('');
  const searchValueDebounce = useDebounce(searchValue, 500);
  const { searchLoading, searchTokenList } = useSwapProTokenSearch(
    searchValueDebounce,
    isStockMode ? undefined : selectedNetworkId,
  );
  const liveTokenOverride = useLiveTokenOverride();
  const visibleSearchTokenList = useMemo(
    () =>
      isStockMode
        ? searchTokenList.filter((item) => !!item.stock)
        : searchTokenList,
    [isStockMode, searchTokenList],
  );
  const stockCategoryType = useMemo(() => {
    const stockCategory = spotCategories.find((category) =>
      isMarketStockCategory({
        id: category.type,
        name: category.name,
      }),
    );
    return stockCategory?.type;
  }, [spotCategories]);

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

  const selectSwapStockToken = useCallback(
    (item: IMarketToken) => {
      if (!item.stock) {
        return;
      }
      const token = buildStockSwapTokenFromMarketToken(item);
      void tokenDetailActions.current.changeActiveToken({
        tokenAddress: token.contractAddress ?? '',
        networkId: token.networkId,
        isNative: !!token.isNative,
      });
      appEventBus.emit(EAppEventBusNames.SwapStockTokenSelected, token);
      navigation.popStack();
    },
    [navigation, tokenDetailActions],
  );

  const navigateToTokenDetail = useCallback(
    (token: {
      address: string;
      networkId: string;
      isNative?: boolean;
      perpsCoin?: string;
    }) => {
      if (token.perpsCoin) {
        navigation.popStack();
        navigateToPerps(token.perpsCoin);
        return;
      }

      navigateToMarketTokenDetail(token, {
        tokenDetailActions,
        beforeNavigate: () => navigation.popStack(),
      });
    },
    [tokenDetailActions, navigation, navigateToPerps],
  );

  const handleTokenSelect = useCallback(
    (item: IMarketToken) => {
      if (isSwapStockSelectTarget) {
        selectSwapStockToken(item);
        return;
      }
      navigateToTokenDetail(item);
    },
    [isSwapStockSelectTarget, navigateToTokenDetail, selectSwapStockToken],
  );

  const handleSearchTokenSelect = useCallback(
    (token: IMarketSearchV2Token & { networkLogoURI: string }) => {
      if (isSwapStockSelectTarget) {
        selectSwapStockToken(convertSearchTokenToMarketToken(token));
        return;
      }
      navigateToTokenDetail({
        address: token.address,
        networkId: token.network,
        isNative: token.isNative,
      });
    },
    [isSwapStockSelectTarget, navigateToTokenDetail, selectSwapStockToken],
  );

  let listContent = (
    <>
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={handleNetworkIdChange}
        placement="bottom-start"
        containerStyle={{ px: '$4', pt: '$3', pb: '$2' }}
        startListSelect={startListSelect}
        onStartListSelect={handleStartListSelect}
      />

      {startListSelect ? (
        <MarketWatchlistTokenList
          onItemPress={handleTokenSelect}
          hidePerps
          liveTokenOverride={liveTokenOverride}
          pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
        />
      ) : (
        <MarketNormalTokenList
          onItemPress={handleTokenSelect}
          networkId={selectedNetworkId}
          liveTokenOverride={liveTokenOverride}
          pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
        />
      )}
    </>
  );

  if (isStockMode) {
    listContent = stockCategoryType ? (
      <MarketNormalTokenList
        onItemPress={handleTokenSelect}
        networkId={ALL_NETWORK_ID}
        selectedCategory={stockCategoryType}
        liveTokenOverride={liveTokenOverride}
        pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
      />
    ) : (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    );
  }

  if (searchValueDebounce) {
    listContent = (
      <SwapProSearchTokenList
        isLoading={searchLoading}
        items={visibleSearchTokenList}
        onPress={handleSearchTokenSelect}
      />
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search })}
      />
      <Page.Body>
        <Stack px="$5" pb="$4">
          <SearchBar
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            value={searchValue}
            onChangeText={setSearchValue}
          />
        </Stack>

        {listContent}
      </Page.Body>
    </Page>
  );
}

function MobileTokenSelectorModal() {
  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <MobileTokenSelectorContent />
    </MarketWatchListProviderMirrorV2>
  );
}

export default MobileTokenSelectorModal;
