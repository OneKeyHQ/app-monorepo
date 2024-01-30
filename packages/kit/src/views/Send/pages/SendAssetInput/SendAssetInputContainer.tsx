import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useTokenListActions,
  withTokenListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendAssetInputContainer() {
  const { refreshTokenList, refreshTokenListMap } =
    useTokenListActions().current;

  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendAssetInput>>();

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const { networkId, accountId, tokens } = route.params;

  usePromiseResult(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccountOfWallet({
      accountId,
      indexedAccountId: '',
      networkId,
      deriveType: 'default',
    });
    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      networkId,
      accountAddress: account.address,
      mergeTokens: true,
    });

    refreshTokenList({ keys: r.tokens.keys, tokens: r.tokens.data });
    refreshTokenListMap(r.tokens.map);
  }, [accountId, networkId, refreshTokenList, refreshTokenListMap]);

  const handleTokenOnPress = useCallback(
    (token: IAccountToken) => {
      navigation.push(EModalSendRoutes.SendDataInput, {
        networkId,
        accountId,
        isNFT: false,
        token,
      });
    },
    [accountId, navigation, networkId],
  );

  useEffect(() => {
    if (tokens) {
      refreshTokenList({ tokens: tokens.data, keys: tokens.keys });
      refreshTokenListMap(tokens.map);
    }
  }, [refreshTokenList, refreshTokenListMap, tokens]);

  return (
    <Page>
      <Page.Body>
        <TokenListView onPressToken={handleTokenOnPress} />
      </Page.Body>
    </Page>
  );
}

const SendAssetInputContainerWithProvider = memo(
  withTokenListProvider(SendAssetInputContainer),
);

export { SendAssetInputContainer, SendAssetInputContainerWithProvider };
