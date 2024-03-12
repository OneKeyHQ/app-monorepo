import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Container } from '@onekeyhq/kit/src/components/Container';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSendConfirmActions,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import SendConfirmActionsContainer from './SendConfirmActionsContainer';
import TxActionsContainer from './TxActionsContainer';
import TxFeeContainer from './TxFeeContainer';
import TxSimulationContainer from './TxSimulationContainer';

import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const tableLayout = false;
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const { updateUnsignedTxs, updateNativeTokenInfo, updateSendFeeStatus } =
    useSendConfirmActions().current;
  const {
    accountId,
    networkId,
    unsignedTxs,
    onSuccess,
    onFail,
    sourceInfo,
    signOnly,
  } = route.params;

  usePromiseResult(async () => {
    updateUnsignedTxs(unsignedTxs);
    updateNativeTokenInfo({
      isLoading: true,
      balance: '0',
    });
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      networkId,
      accountId,
    });
    const r = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      networkId,
      accountAddress: account.address,
      contractList: [''],
    });

    updateNativeTokenInfo({
      isLoading: false,
      balance: r[0].balanceParsed,
    });
  }, [
    accountId,
    networkId,
    unsignedTxs,
    updateNativeTokenInfo,
    updateUnsignedTxs,
  ]);

  useEffect(
    () => () =>
      updateSendFeeStatus({ status: ESendFeeStatus.Idle, errMessage: '' }),
    [updateSendFeeStatus],
  );

  const renderSendConfirmView = useCallback(() => {
    if (tableLayout) {
      return (
        <Page.Body>
          <XStack h="100%" px="$5">
            <Container.Box
              blockProps={{ width: '236px', pb: '$5' }}
              contentProps={{
                height: '100%',
                flexDirection: 'column-reverse',
                justifyContent: 'space-between',
              }}
            >
              <TxSimulationContainer tableLayout={tableLayout} />
            </Container.Box>
            <YStack flex={1} justifyContent="space-between" mr="$-5">
              <TxActionsContainer
                accountId={accountId}
                networkId={networkId}
                tableLayout={tableLayout}
              />
              <YStack>
                <TxFeeContainer
                  accountId={accountId}
                  networkId={networkId}
                  tableLayout={tableLayout}
                />
                <SendConfirmActionsContainer
                  sourceInfo={sourceInfo}
                  signOnly={signOnly}
                  accountId={accountId}
                  networkId={networkId}
                  onSuccess={onSuccess}
                  onFail={onFail}
                  tableLayout={tableLayout}
                />
              </YStack>
            </YStack>
          </XStack>
        </Page.Body>
      );
    }

    return (
      <>
        <Page.Body px="$5">
          <TxActionsContainer accountId={accountId} networkId={networkId} />
          <TxFeeContainer accountId={accountId} networkId={networkId} />
          <TxSimulationContainer />
        </Page.Body>
        <SendConfirmActionsContainer
          sourceInfo={sourceInfo}
          signOnly={signOnly}
          accountId={accountId}
          networkId={networkId}
          onSuccess={onSuccess}
          onFail={onFail}
        />
      </>
    );
  }, [
    accountId,
    networkId,
    onFail,
    onSuccess,
    signOnly,
    sourceInfo,
    tableLayout,
  ]);

  return (
    <Page scrollEnabled={!tableLayout}>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      />
      {renderSendConfirmView()}
    </Page>
  );
}

const SendConfirmContainerWithProvider = memo(
  withSendConfirmProvider(SendConfirmContainer),
);

export { SendConfirmContainer, SendConfirmContainerWithProvider };
