import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

    const blockedTokens =
      await backgroundApiProxy.serviceToken.getBlockedTokens({
        networkId,
      });

    const filteredTokens = allTokens.data.filter(
      (token) => !blockedTokens[token.address],
    );

    refreshTokenList({ keys: allTokens.keys, tokens: filteredTokens });
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
        refreshTokenListMap(tokens.map);
        updateTokenListState({ initialized: true, isRefreshing: false });
      } else {
        void fetchAccountTokens();
      }
    };

    void updateTokenList();
  }, [
    fetchAccountTokens,
    networkId,
    refreshTokenList,
    refreshTokenListMap,
    tokens,
    updateTokenListState,
  ]);

  const debounceUpdateSearchKey = useDebouncedCallback(updateSearchKey, 200);

  const tokensLength = tokenList.tokens.length;
  const headerSearchBarOptions = useMemo(
    () =>
      tokensLength > 10
        ? {
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
          }
        : undefined,
    [debounceUpdateSearchKey, intl, tokensLength],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_select_crypto,
        })}
        headerSearchBarOptions={headerSearchBarOptions}
      />
      <Page.Body>
        {/* {networkName ? <SectionList.SectionHeader title={networkName} /> : null} */}
        <TokenListView
          withPresetVerticalPadding={false}
          onPressToken={handleTokenOnPress}
        />
      </Page.Body>
    </Page>
  );
}

const TokenSelectorWithProvider = memo(withTokenListProvider(TokenSelector));

export default TokenSelectorWithProvider;
