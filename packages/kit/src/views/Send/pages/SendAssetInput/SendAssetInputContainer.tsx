import { memo, useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useTokenListActions,
  withTokenListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/token-list';
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

  const { networkId, accountId } = route.params;

  const promise = usePromiseResult(async () => {
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
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendDataInput,
        params: {
          networkId,
          accountId,
          isNFT: false,
          token,
        },
      });
    },
    [accountId, navigation, networkId],
  );

  return (
    <Page>
      <Page.Body>
        <TokenListView
          isLoading={promise.isLoading}
          onPressToken={handleTokenOnPress}
        />
      </Page.Body>
    </Page>
  );
}

const SendAssetInputContainerWithProvider = memo(
  withTokenListProvider(SendAssetInputContainer),
);

export { SendAssetInputContainer, SendAssetInputContainerWithProvider };
