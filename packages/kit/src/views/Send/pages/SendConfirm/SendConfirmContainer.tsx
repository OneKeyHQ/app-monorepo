import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Container } from '@onekeyhq/kit/src/components/Container';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSendConfirmActions,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import SendConfirmActionsContainer from './SendConfirmActionsContainer';
import TxActionsContainer from './TxActionsContainer';
import TxFeeContainer from './TxFeeContainer';
import TxSimulationContainer from './TxSimulationContainer';
import { TxSourceInfoContainer } from './TxSourceInfoContainer';

import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const tableLayout = false;
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const { updateUnsignedTxs, updateNativeTokenInfo, updateSendFeeStatus } =
    useSendConfirmActions().current;
  const [settings] = useSettingsPersistAtom();
  const {
    accountId,
    networkId,
    unsignedTxs,
    onSuccess,
    onFail,
    onCancel,
    sourceInfo,
    signOnly,
    useFeeInTx,
    transferPayload,
  } = route.params;
  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  usePromiseResult(async () => {
    updateUnsignedTxs(unsignedTxs);
    updateNativeTokenInfo({
      isLoading: true,
      balance: '0',
      logoURI: '',
    });
    const [accountAddress, xpub, nativeTokenAddress] = await Promise.all([
      backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      }),
      backgroundApiProxy.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      backgroundApiProxy.serviceToken.getNativeTokenAddress({ networkId }),
    ]);
    const checkInscriptionProtectionEnabled =
      await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
        {
          networkId,
          accountId,
        },
      );
    const withCheckInscription =
      checkInscriptionProtectionEnabled && settings.inscriptionProtection;
    const r = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      networkId,
      accountAddress,
      contractList: [nativeTokenAddress],
      xpub,
      withFrozenBalance: true,
      withCheckInscription,
    });
    const balance = r[0].balanceParsed;
    updateNativeTokenInfo({
      isLoading: false,
      balance,
      logoURI: r[0].info.logoURI ?? '',
    });
  }, [
    accountId,
    networkId,
    unsignedTxs,
    updateNativeTokenInfo,
    updateUnsignedTxs,
    settings.inscriptionProtection,
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
                transferPayload={transferPayload}
              />
              <YStack>
                <TxFeeContainer
                  accountId={accountId}
                  networkId={networkId}
                  tableLayout={tableLayout}
                  useFeeInTx={useFeeInTx}
                />
                <SendConfirmActionsContainer
                  sourceInfo={sourceInfo}
                  signOnly={signOnly}
                  accountId={accountId}
                  networkId={networkId}
                  onSuccess={onSuccess}
                  onFail={onFail}
                  onCancel={onCancel}
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
        <Page.Body px="$5" space="$4">
          <TxSourceInfoContainer sourceInfo={sourceInfo} />
          <TxActionsContainer
            accountId={accountId}
            networkId={networkId}
            transferPayload={transferPayload}
          />
          <TxFeeContainer
            accountId={accountId}
            networkId={networkId}
            useFeeInTx={useFeeInTx}
          />
          <TxSimulationContainer />
        </Page.Body>
        <SendConfirmActionsContainer
          sourceInfo={sourceInfo}
          signOnly={signOnly}
          accountId={accountId}
          networkId={networkId}
          onSuccess={onSuccess}
          onFail={onFail}
          onCancel={onCancel}
        />
      </>
    );
  }, [
    tableLayout,
    sourceInfo,
    accountId,
    networkId,
    useFeeInTx,
    signOnly,
    onSuccess,
    onFail,
    onCancel,
    transferPayload,
  ]);

  return (
    <Page
      scrollEnabled={!tableLayout}
      onClose={(confirmed) => {
        if (!confirmed) {
          dappApprove.reject();
        }
      }}
    >
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
