import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, ScrollView, Stack, YStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { InteractInfo } from '../../components/InteractInfo';
import { SendActions } from '../../components/SendActions';
import { SingerInfo } from '../../components/SingerInfo';
import { EModalSendRoutes } from '../../router';

import { TxActionsContainer } from './TxActionsContainer';
import { TxGasFeeContainer } from './TxGasFeeContainer';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { accountId, networkId, unsignedTxs, transfersInfo } = route.params;

  const handleConfirm = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendProgress,
      params: {
        accountId,
        networkId,
        unsignedTxs,
        transfersInfo,
      },
    });
  }, [accountId, navigation, networkId, transfersInfo, unsignedTxs]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      />
      <Page.Body>
        <ScrollView px="$5">
          <YStack space="$5">
            <InteractInfo />
            <SingerInfo />
            <TxActionsContainer
              unsignedTxs={unsignedTxs}
              transfersInfo={transfersInfo}
            />
          </YStack>
        </ScrollView>
      </Page.Body>
      <Page.Footer>
        <Stack padding="$5">
          <TxGasFeeContainer
            accountId={accountId}
            networkId={networkId}
            unsignedTxs={unsignedTxs}
          />
          <SendActions
            onConfirm={handleConfirm}
            onCancel={() => navigation.popStack()}
          />
        </Stack>
      </Page.Footer>
    </Page>
  );
}

export { SendConfirmContainer };
