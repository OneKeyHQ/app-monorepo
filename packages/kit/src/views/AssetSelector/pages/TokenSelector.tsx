import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSearchKeyAtom,
  useTokenListActions,
  withTokenListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { useAccountData } from '../../../hooks/useAccountData';

import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

function TokenSelector() {
  const intl = useIntl();
  const {
    refreshTokenList,
    refreshTokenListMap,
    updateSearchKey,
    updateTokenListState,
    updateSearchTokenState,
    refreshSearchTokenList,
  } = useTokenListActions().current;

  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const navigation = useAppNavigation();

  const {
    networkId,
    accountId,
    tokens,
    closeAfterSelect = true,
    onSelect,
    tokenListState,
    searchAll,
  } = route.params;

  const { network } = useAccountData({ networkId });

  const [searchKey] = useSearchKeyAtom();

  const handleTokenOnPress = useCallback(
    (token: IToken) => {
      if (closeAfterSelect) {
        navigation.pop();
      }
      void onSelect?.(token);
    },
    [closeAfterSelect, navigation, onSelect],
  );

  const fetchAccountTokens = useCallback(async () => {
    updateTokenListState({ initialized: false, isRefreshing: true });

    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      accountId,
      networkId,
      mergeTokens: true,
      flag: 'token-selector',
    });
    const { allTokens } = r;
    if (!allTokens) {
      updateTokenListState({ isRefreshing: false });
      throw new Error('allTokens not found from fetchAccountTokensWithMemo ');
    }

    const blockedTokens =
      await backgroundApiProxy.serviceToken.getBlockedTokens({
        networkId,
      });

    const filteredTokens = allTokens.data.filter(
      (token) => !blockedTokens[token.address],
    );

    refreshTokenList({ keys: allTokens.keys, tokens: filteredTokens });
    refreshTokenListMap({
      tokens: allTokens.map,
    });
    updateTokenListState({ initialized: true, isRefreshing: false });
  }, [
    accountId,
    networkId,
    refreshTokenList,
    refreshTokenListMap,
    updateTokenListState,
  ]);

  useEffect(() => {
    // use route params token
    const updateTokenList = async () => {
      if (tokens && tokens.data.length) {
        const blockedTokens =
          await backgroundApiProxy.serviceToken.getBlockedTokens({
            networkId,
          });

        const filteredTokens = tokens.data.filter(
          (token) => !blockedTokens[token.address],
        );

        refreshTokenList({ tokens: filteredTokens, keys: tokens.keys });
        refreshTokenListMap({
          tokens: tokens.map,
        });
        updateTokenListState({ initialized: true, isRefreshing: false });
      } else if (!network?.isAllNetworks && !tokenListState?.isRefreshing) {
        void fetchAccountTokens();
      }
    };

    void updateTokenList();
  }, [
    fetchAccountTokens,
    network?.isAllNetworks,
    networkId,
    refreshTokenList,
    refreshTokenListMap,
    tokenListState?.isRefreshing,
    tokens,
    updateTokenListState,
  ]);

  useEffect(() => {
    const updateTokenList = ({
      tokens: tokensFromOut,
      keys,
      map,
      merge,
    }: {
      tokens: IAccountToken[];
      keys: string;
      map: Record<string, ITokenFiat>;
      merge?: boolean;
    }) => {
      updateTokenListState({ initialized: true, isRefreshing: false });
      refreshTokenList({ tokens: tokensFromOut, keys, merge });
      refreshTokenListMap({ tokens: map, merge });
    };
    appEventBus.on(EAppEventBusNames.TokenListUpdate, updateTokenList);
    return () => {
      appEventBus.off(EAppEventBusNames.TokenListUpdate, updateTokenList);
    };
  }, [refreshTokenList, refreshTokenListMap, updateTokenListState]);

  const debounceUpdateSearchKey = useDebouncedCallback(
    updateSearchKey,
    searchAll ? 1000 : 200,
  );

  const headerSearchBarOptions = useMemo(
    () => ({
      placeholder: intl.formatMessage({
        id: ETranslations.send_token_selector_search_placeholder,
      }),
      onChangeText: ({
        nativeEvent,
      }: {
        nativeEvent: TextInputFocusEventData;
      }) => {
        debounceUpdateSearchKey(nativeEvent.text);
      },
    }),
    [debounceUpdateSearchKey, intl],
  );

  const searchTokensBySearchKey = useCallback(
    async (keywords: string) => {
      updateSearchTokenState({ isSearching: true });
      await backgroundApiProxy.serviceToken.abortSearchTokens();
      try {
        const result = await backgroundApiProxy.serviceToken.searchTokens({
          accountId,
          networkId,
          keywords,
        });
        refreshSearchTokenList({ tokens: result });
      } catch (e) {
        console.log(e);
      }
      updateSearchTokenState({ isSearching: false });
    },
    [accountId, networkId, refreshSearchTokenList, updateSearchTokenState],
  );

  useEffect(() => {
    if (searchAll && searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      void searchTokensBySearchKey(searchKey);
    } else {
      updateSearchTokenState({ isSearching: false });
      refreshSearchTokenList({ tokens: [] });
      void backgroundApiProxy.serviceToken.abortSearchTokens();
    }
  }, [
    refreshSearchTokenList,
    searchAll,
    searchKey,
    searchTokensBySearchKey,
    updateSearchTokenState,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_select_crypto,
        })}
        headerSearchBarOptions={headerSearchBarOptions}
      />
      <Page.Body>
        <TokenListView
          withPresetVerticalPadding={false}
          onPressToken={handleTokenOnPress}
          isAllNetworks={network?.isAllNetworks}
          withNetwork={network?.isAllNetworks}
          searchAll={searchAll}
          isTokenSelectorLayout
        />
      </Page.Body>
    </Page>
  );
}

const TokenSelectorWithProvider = memo(withTokenListProvider(TokenSelector));

export default TokenSelectorWithProvider;
