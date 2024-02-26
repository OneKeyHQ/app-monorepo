import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, SectionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useTokenListActions,
  withTokenListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IToken } from '@onekeyhq/shared/types/token';

import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '../router/types';
import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

function TokenSelector() {
  const intl = useIntl();
  const { refreshTokenList, refreshTokenListMap, updateSearchKey } =
    useTokenListActions().current;

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
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      networkId,
      accountAddress: account.address,
      mergeTokens: true,
      flag: 'token-selector',
    });
    const { allTokens } = r;
    if (!allTokens) {
      throw new Error('allTokens not found from fetchAccountTokensWithMemo ');
    }
    refreshTokenList({ keys: allTokens.keys, tokens: allTokens.data });
    refreshTokenListMap(allTokens.map);
  }, [accountId, networkId, refreshTokenList, refreshTokenListMap]);

  useEffect(() => {
    // use route params token
    if (tokens && tokens.data.length) {
      refreshTokenList({ tokens: tokens.data, keys: tokens.keys });
      refreshTokenListMap(tokens.map);
    } else {
      void fetchAccountTokens();
    }
  }, [fetchAccountTokens, refreshTokenList, refreshTokenListMap, tokens]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'action__select_token' })}
        headerSearchBarOptions={{
          placeholder: 'Search symbol or contract address',
          onChangeText: debounce(
            ({ nativeEvent }: { nativeEvent: TextInputFocusEventData }) => {
              updateSearchKey(nativeEvent.text);
            },
            800,
          ),
        }}
      />
      <Page.Body>
        {networkName && <SectionList.SectionHeader title={networkName} />}
        <TokenListView onPressToken={handleTokenOnPress} />
      </Page.Body>
    </Page>
  );
}

const TokenSelectorWithProvider = memo(withTokenListProvider(TokenSelector));

export default TokenSelectorWithProvider;
