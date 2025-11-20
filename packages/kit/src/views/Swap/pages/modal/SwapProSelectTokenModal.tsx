import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapProSelectTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketNormalTokenList } from '../../../Market/MarketHomeV2/components/MarketTokenList';
import { MarketTokenListNetworkSelector } from '../../../Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { MarketWatchListProviderMirrorV2 } from '../../../Market/MarketWatchListProviderMirrorV2';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { IMarketToken } from '../../../Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { RouteProp } from '@react-navigation/core';

const SwapProSelectTokenPage = () => {
  const intl = useIntl();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('evm--1');
  const [, setSwapProSelectToken] = useSwapProSelectTokenAtom();
  const [searchValue, setSearchValue] = useState<string>('');
  const handleNetworkIdChange = (networkId: string) => {
    setSelectedNetworkId(networkId);
  };
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
  return (
    <Page>
      <Page.Header headerTitle="Swap Pro" />
      <Page.Body>
        <Stack px="$5" pb="$4">
          <SearchBar
            placeholder={intl.formatMessage({
              id: ETranslations.token_selector_search_placeholder,
            })}
            zIndex={20}
            selectTextOnFocus
            value={searchValue}
            onSearchTextChange={setSearchValue}
          />
        </Stack>
        <MarketTokenListNetworkSelector
          selectedNetworkId={selectedNetworkId}
          onSelectNetworkId={handleNetworkIdChange}
          placement="bottom-start"
          containerStyle={{
            px: '$4',
            pt: '$3',
            pb: '$2',
          }}
        />
        <MarketNormalTokenList
          onItemPress={handleTokenSelect}
          networkId={selectedNetworkId}
        />
      </Page.Body>
    </Page>
  );
};

const SwapProSelectTokenModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapProSelectToken>
    >();
  const { storeName } = route.params;
  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <SwapProviderMirror storeName={storeName}>
        <SwapProSelectTokenPage />
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
