import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketNormalTokenList } from '../../../Market/MarketHomeV2/components/MarketTokenList';
import { MarketTokenListNetworkSelector } from '../../../Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { IMarketToken } from '../../../Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { RouteProp } from '@react-navigation/core';

const SwapProSelectTokenPage = () => {
  const intl = useIntl();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('evm--1');
  const [searchValue, setSearchValue] = useState<string>('');
  const handleNetworkIdChange = (networkId: string) => {
    setSelectedNetworkId(networkId);
  };

  const handleTokenSelect = (token: IMarketToken) => {
    console.log('token', token);
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
            autoFocus
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
    <SwapProviderMirror storeName={storeName}>
      <SwapProSelectTokenPage />
    </SwapProviderMirror>
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
