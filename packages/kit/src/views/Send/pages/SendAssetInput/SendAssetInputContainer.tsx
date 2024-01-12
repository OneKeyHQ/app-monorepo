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
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.SendAmountInput>
    >();

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const { networkId, accountId, transfersInfo } = route.params;

  const promise = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      networkId,
      accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
    });
    refreshTokenList({ keys: r.keys, tokens: r.data });
    refreshTokenListMap(r.map);
  }, [networkId, refreshTokenList, refreshTokenListMap]);

  const handleTokenOnPress = useCallback(
    (token: IAccountToken) => {
      const updatedTransfersInfo = transfersInfo.map((transferInfo) => ({
        ...transferInfo,
        token: token.info.address,
      }));
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendAddressInput,
        params: {
          networkId,
          accountId,
          transfersInfo: updatedTransfersInfo,
        },
      });
    },
    [accountId, navigation, networkId, transfersInfo],
  );

  return (
    <Page>
      <Page.Body>
        <TokenListView
          isLoading={promise.isLoading}
          onPress={handleTokenOnPress}
        />
      </Page.Body>
    </Page>
  );
}

const SendAssetInputContainerWithProvider = memo(
  withTokenListProvider(SendAssetInputContainer),
);

export { SendAssetInputContainer, SendAssetInputContainerWithProvider };
