import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
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

function TokenSelector() {
  const intl = useIntl();
  const { refreshTokenList, refreshTokenListMap } =
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
      onSelect?.(token);
    },
    [closeAfterSelect, navigation, onSelect],
  );

  const fetchAccountTokens = useCallback(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const r = await backgroundApiProxy.serviceToken.fetchAccountTokensWithMemo({
      networkId,
      accountAddress: account.address,
      mergeTokens: true,
    });
    refreshTokenList({ keys: r.tokens.keys, tokens: r.tokens.data });
    refreshTokenListMap(r.tokens.map);
  }, [accountId, networkId, refreshTokenList, refreshTokenListMap]);

  useEffect(() => {
    if (tokens) {
      refreshTokenList({ tokens: tokens.data, keys: tokens.keys });
      refreshTokenListMap(tokens.map);
    }
    void fetchAccountTokens();
  }, [fetchAccountTokens, refreshTokenList, refreshTokenListMap, tokens]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'action__select_token' })}
        headerSearchBarOptions={{
          placeholder: 'Search symbol or contract address',
        }}
      />
      <Page.Body>
        {networkName && <SectionList.SectionHeader title={networkName} />}
        <TokenListView onPressToken={handleTokenOnPress} withName />
      </Page.Body>
    </Page>
  );
}

const TokenSelectorWithProvider = memo(withTokenListProvider(TokenSelector));

export default TokenSelectorWithProvider;
