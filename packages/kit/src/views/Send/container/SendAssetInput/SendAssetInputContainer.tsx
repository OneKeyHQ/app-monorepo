import { memo, useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { TokenListView } from '../../../../components/TokenListView';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../../routes/Modal/type';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../../states/jotai/contexts/token-list';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendAssetInputContainer() {
  const { refreshTokenList, refreshTokenListMap } = useTokenListActions();

  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.SendAmountInput>
    >();

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const { networkId, accountId, transfersInfo } = route.params;

  const promise = usePromiseResult(async () => {
    const r =
      await backgroundApiProxy.serviceToken.fetchAccountTokensForDeepRefresh({
        accountId,
        networkId,
        accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
      });
    refreshTokenList(r);
    refreshTokenListMap(r.map);
  }, [accountId, networkId, refreshTokenList, refreshTokenListMap]);

  const handleTokenOnPress = useCallback(
    (token: IAccountToken) => {
      const updatedTransfersInfo = transfersInfo.map((transferInfo) => ({
        ...transferInfo,
        token: token.address,
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
