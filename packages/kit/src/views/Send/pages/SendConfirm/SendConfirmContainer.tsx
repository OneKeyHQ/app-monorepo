import { memo, useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSendSelectedFeeInfoAtom,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';

import { SendActions } from '../../components/SendActions';
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

  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();

  const handleConfirm = useCallback(async () => {
    const newUnsignedTxs = [];
    for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
      const unsignedTx = unsignedTxs[i];
      const newUnsignedTx =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          accountId,
          networkId,
          unsignedTx,
          feeInfo: sendSelectedFeeInfo,
        });

      newUnsignedTxs.push(newUnsignedTx);
    }

    navigation.push(EModalSendRoutes.SendProgress, {
      networkId,
      accountId,
      unsignedTxs: newUnsignedTxs,
    });
  }, [accountId, navigation, networkId, sendSelectedFeeInfo, unsignedTxs]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      />
      <Page.Body>
        <YStack space="$5" px="$5">
          <TxActionsContainer
            accountId={accountId}
            networkId={networkId}
            unsignedTxs={unsignedTxs}
          />
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
