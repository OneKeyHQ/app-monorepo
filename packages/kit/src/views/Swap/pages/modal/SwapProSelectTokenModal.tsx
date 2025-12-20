import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useSwapProSelectTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import {
  MarketNormalTokenList,
  MarketWatchlistTokenList,
} from '../../../Market/MarketHomeV2/components/MarketTokenList';
import { MarketTokenListNetworkSelector } from '../../../Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { MarketWatchListProviderMirrorV2 } from '../../../Market/MarketWatchListProviderMirrorV2';
import { useSwapProTokenSearch } from '../../hooks/useSwapPro';
import SwapProSearchTokenList from '../components/SwapProSearchTokenList';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { IMarketToken } from '../../../Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { RouteProp } from '@react-navigation/core';

interface ISwapProSelectTokenPageProps {
  autoSearch?: boolean;
}
const SwapProSelectTokenPage = ({
  autoSearch,
}: ISwapProSelectTokenPageProps) => {
  const intl = useIntl();
  const [swapProTokenSelect, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(swapProTokenSelect?.networkId ?? 'evm--1');
  const [startListSelect, setStartListSelect] = useState(false);
  const [searchValue, setSearchValue] = useState<string>('');
  const handleNetworkIdChange = (networkId: string) => {
    setStartListSelect(false);
    setSelectedNetworkId(networkId);
  };
  const searchValueDebounce = useDebounce(searchValue, 500, { leading: true });
  const { searchLoading, searchTokenList } = useSwapProTokenSearch(
    searchValueDebounce,
    selectedNetworkId,
  );
  const navigation = useAppNavigation();
  const handleTokenSelect = (token: IMarketToken) => {
    setSwapProSelectToken({
      networkId: token.networkId,
      contractAddress: token.address,
      decimals: token.decimals,
      symbol: token.symbol,
      logoURI: token.tokenImageUri,
      networkLogoURI: token.networkLogoUri,
      name: token.name,
      isNative: token.isNative,
      price: token.price?.toString(),
    });
    navigation.pop();
  };
  const handleSearchTokenSelect = (
    token: IMarketSearchV2Token & { networkLogoURI: string },
  ) => {
    setSwapProSelectToken({
      networkId: token.network,
      contractAddress: token.address,
      decimals: token.decimals,
      symbol: token.symbol,
      logoURI: token.logoUrl,
      networkLogoURI: token.networkLogoURI,
      name: token.name,
      isNative: token.isNative,
      price: token.price?.toString(),
    });
    navigation.pop();
  };
  return (
    <Page>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.dexmarket_pro,
        })}
      />
      <Page.Body>
        <Stack px="$5" pb="$4">
          <SearchBar
            autoFocus={autoSearch}
            placeholder={intl.formatMessage({
              id: ETranslations.token_selector_search_placeholder,
            })}
            zIndex={20}
            selectTextOnFocus
            value={searchValue}
            onSearchTextChange={setSearchValue}
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
              containerStyle={{
                px: '$4',
                pt: '$3',
                pb: '$2',
              }}
              startListSelect={startListSelect}
              onStartListSelect={() => {
                setStartListSelect(true);
                setSelectedNetworkId(undefined);
              }}
            />
            {startListSelect ? (
              <MarketWatchlistTokenList
                onItemPress={handleTokenSelect}
                hideNativeToken
              />
            ) : (
              <MarketNormalTokenList
                onItemPress={handleTokenSelect}
                networkId={selectedNetworkId}
              />
            )}
          </>
        )}
      </Page.Body>
    </Page>
  );
};

const SwapProSelectTokenModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapProSelectToken>
    >();
  const { storeName, autoSearch = false } = route.params;
  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <SwapProviderMirror storeName={storeName}>
        <SwapProSelectTokenPage autoSearch={autoSearch} />
      </SwapProviderMirror>
    </MarketWatchListProviderMirrorV2>
  );
};
export default function SwapProSelectTokenModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapProSelectTokenModalWithProvider />
    </AccountSelectorProviderMirror>
  );
}
