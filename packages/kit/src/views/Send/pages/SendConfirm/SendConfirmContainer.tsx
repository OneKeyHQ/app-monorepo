import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSendConfirmActions,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';

import { InteractInfo } from '../../components/InteractInfo';
import { SendActions } from '../../components/SendActions';
import { SingerInfo } from '../../components/SingerInfo';
import { EModalSendRoutes } from '../../router';

import { TxActionsContainer } from './TxActionsContainer';
import { TxFeeContainer } from './TxFeeContainer';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { accountId, networkId, unsignedTxs } = route.params;

  const { updateUnsignedTxs } = useSendConfirmActions().current;

  const handleConfirm = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EModalSendRoutes.SendProgress);
  }, [navigation]);

  useEffect(
    () => updateUnsignedTxs(unsignedTxs),
    [unsignedTxs, updateUnsignedTxs],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      />
      <Page.Body>
        <YStack space="$5">
          <InteractInfo />
          <SingerInfo />
          <TxActionsContainer />
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Stack padding="$5">
          <TxFeeContainer
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

const SendConfirmContainerWithProvider = memo(
  withSendConfirmProvider(SendConfirmContainer),
);

export { SendConfirmContainer, SendConfirmContainerWithProvider };
