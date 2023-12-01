import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Page,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { InteractInfo } from '../../components/interactInfo';
import { SendActions } from '../../components/SendActions';
import { SingerInfo } from '../../components/SingerInfo';
import { EModalSendRoutes } from '../../types';

import { TxActionsContainer } from './TxActionsContainer';
import { TxFeeContainer } from './TxFeeContainer';

import type { IModalSendParamList } from '../../types';
import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { unsignedTx, transfersInfo } = route.params;

  const handleConfirm = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendProgress,
      params: {
        unsignedTx,
        transfersInfo,
      },
    });
  }, [navigation, transfersInfo, unsignedTx]);

  return (
    <Page>
      <Page.Body>
        <ScrollView px="$5">
          <YStack space="$5">
            <InteractInfo />
            <SingerInfo />
          </YStack>
        </ScrollView>
      </Page.Body>
      <Page.Footer>
        <Stack padding="$5">
          <TxFeeContainer />
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
