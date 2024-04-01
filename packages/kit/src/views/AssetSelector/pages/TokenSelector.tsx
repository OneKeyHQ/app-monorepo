import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Page, SectionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useTokenListActions,
  useTokenListAtom,
  withTokenListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

function TokenSelector() {
  const intl = useIntl();
  const {
    refreshTokenList,
    refreshTokenListMap,
    updateSearchKey,
    updateTokenListState,
  } = useTokenListActions().current;

  const [tokenList] = useTokenListAtom();

  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const navigation = useAppNavigation();

  const {
    networkId,
    accountId,
    tokens,
    networkName,
    closeAfterSelect = true,
    onSelect,
  } = route.params;

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
    const accountAddress =
      await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });

    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      networkId,
      accountAddress,
      mergeTokens: true,
      flag: 'token-selector',
    });
    const { allTokens } = r;
    if (!allTokens) {
      updateTokenListState({ isRefreshing: false });
      throw new Error('allTokens not found from fetchAccountTokensWithMemo ');
    }
    refreshTokenList({ keys: allTokens.keys, tokens: allTokens.data });
    refreshTokenListMap(allTokens.map);
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
    if (tokens && tokens.data.length) {
      refreshTokenList({ tokens: tokens.data, keys: tokens.keys });
      refreshTokenListMap(tokens.map);
      updateTokenListState({ initialized: true, isRefreshing: false });
    } else {
      void fetchAccountTokens();
    }
  }, [
    fetchAccountTokens,
    refreshTokenList,
    refreshTokenListMap,
    tokens,
    updateTokenListState,
  ]);

  const debounceUpdateSearchKey = useDebouncedCallback(updateSearchKey, 800);

  const tokensLength = tokenList.tokens.length;
  const headerSearchBarOptions = useMemo(
    () =>
      tokensLength > 10
        ? {
            placeholder: 'Search symbol or contract address',
            onChangeText: ({
              nativeEvent,
            }: {
              nativeEvent: TextInputFocusEventData;
            }) => {
              debounceUpdateSearchKey(nativeEvent.text);
            },
          }
        : undefined,
    [debounceUpdateSearchKey, tokensLength],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'action__select_token' })}
        headerSearchBarOptions={headerSearchBarOptions}
      />
      <Page.Body>
        {networkName ? <SectionList.SectionHeader title={networkName} /> : null}
        <TokenListView onPressToken={handleTokenOnPress} />
      </Page.Body>
    </Page>
  );
}

const TokenSelectorWithProvider = memo(withTokenListProvider(TokenSelector));

export default TokenSelectorWithProvider;
