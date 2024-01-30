import { memo, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import {
  useSendConfirmActions,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';

import SendConfirmActionsContainer from './SendConfirmActionsContainer';
import TxActionsContainer from './TxActionsContainer';
import TxFeeContainer from './TxFeeContainer';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const { updateUnsignedTxs } = useSendConfirmActions().current;
  const { accountId, networkId, unsignedTxs, onSuccess, onFail } = route.params;

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
        <YStack space="$4" px="$5">
          <TxActionsContainer accountId={accountId} networkId={networkId} />
          <TxFeeContainer accountId={accountId} networkId={networkId} />
        </YStack>
      </Page.Body>
      <SendConfirmActionsContainer
        accountId={accountId}
        networkId={networkId}
        onSuccess={onSuccess}
        onFail={onFail}
      />
    </Page>
  );
}

const SendConfirmContainerWithProvider = memo(
  withSendConfirmProvider(SendConfirmContainer),
);

export { SendConfirmContainer, SendConfirmContainerWithProvider };
