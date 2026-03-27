import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import {
  MarketNormalTokenList,
  MarketWatchlistTokenList,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import SwapProSearchTokenList from '@onekeyhq/kit/src/views/Swap/pages/components/SwapProSearchTokenList';
import {
  EJotaiContextStoreNames,
  useMarketTokenSelectorConfigAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { TOKEN_SELECTOR_POLLING_INTERVAL } from './constants';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';
import { useLiveTokenOverride } from './useLiveTokenOverride';

function MobileTokenSelectorContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tokenDetailActions = useTokenDetailActions();
  const { navigateToPerps } = usePerpsNavigation();

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
    selectedNetworkId,
  );
  const liveTokenOverride = useLiveTokenOverride();

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
      navigateToTokenDetail(item);
    },
    [navigateToTokenDetail],
  );

  const handleSearchTokenSelect = useCallback(
    (token: IMarketSearchV2Token & { networkLogoURI: string }) => {
      navigateToTokenDetail({
        address: token.address,
        networkId: token.network,
        isNative: token.isNative,
      });
    },
    [navigateToTokenDetail],
  );

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
        )}
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
