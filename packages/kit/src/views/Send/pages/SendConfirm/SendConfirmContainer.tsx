import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Alert, Page, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  usePreCheckTxStatusAtom,
  useSendConfirmActions,
  useSendFeeStatusAtom,
  useSendTxStatusAtom,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';

import SendConfirmActionsContainer from './SendConfirmActionsContainer';
import TxActionsContainer from './TxActionsContainer';
import { TxExtraInfoContainer } from './TxExtraInfoContainer';
import TxFeeContainer from './TxFeeContainer';
import TxSimulationContainer from './TxSimulationContainer';
import { TxSourceInfoContainer } from './TxSourceInfoContainer';

import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const {
    updateUnsignedTxs,
    updateNativeTokenInfo,
    updateSendFeeStatus,
    updatePreCheckTxStatus,
  } = useSendConfirmActions().current;
  const [settings] = useSettingsPersistAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendAlertStatus] = useSendTxStatusAtom();
  const [preCheckTxStatus] = usePreCheckTxStatusAtom();
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

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.SendConfirmContainerMounted, undefined);
  }, []);

  const { network } =
    usePromiseResult(async () => {
      updateUnsignedTxs(unsignedTxs);
      updateNativeTokenInfo({
        isLoading: true,
        balance: '0',
        logoURI: '',
      });
      const [n, nativeTokenAddress] = await Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
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
        accountId,
        contractList: [nativeTokenAddress],
        withFrozenBalance: true,
        withCheckInscription,
      });
      const balance = r[0].balanceParsed;
      updateNativeTokenInfo({
        isLoading: false,
        balance,
        logoURI: r[0].info.logoURI ?? '',
      });
      return { network: n };
    }, [
      accountId,
      networkId,
      unsignedTxs,
      updateNativeTokenInfo,
      updateUnsignedTxs,
      settings.inscriptionProtection,
    ]).result ?? {};

  usePromiseResult(async () => {
    try {
      await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs,
        precheckTiming: ESendPreCheckTimingEnum.BeforeTransaction,
      });
    } catch (e: any) {
      updatePreCheckTxStatus((e as Error).message);
    }
  }, [accountId, networkId, unsignedTxs, updatePreCheckTxStatus]);

  useEffect(
    () => () =>
      updateSendFeeStatus({ status: ESendFeeStatus.Idle, errMessage: '' }),
    [updateSendFeeStatus],
  );

  const renderSendConfirmView = useCallback(
    () => (
      <>
        <Page.Body testID="tx-confirmation-body">
          <Stack>
            {sendFeeStatus.errMessage ? (
              <Alert
                fullBleed
                icon="ErrorOutline"
                type="critical"
                title={sendFeeStatus.errMessage}
              />
            ) : null}
            {sendAlertStatus.isInsufficientNativeBalance ? (
              <Alert
                fullBleed
                icon="ErrorOutline"
                type="critical"
                title={intl.formatMessage(
                  {
                    id: ETranslations.msg__str_is_required_for_network_fees_top_up_str_to_make_tx,
                  },
                  {
                    crypto: network?.symbol ?? '',
                  },
                )}
              />
            ) : null}
            {preCheckTxStatus.errorMessage ? (
              <Alert
                fullBleed
                icon="ErrorOutline"
                type="critical"
                title={preCheckTxStatus.errorMessage}
              />
            ) : null}
          </Stack>
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
          {/* <TxSwapInfoContainer /> */}
          <TxSimulationContainer />
          <TxExtraInfoContainer />
        </Page.Body>
        <SendConfirmActionsContainer
          sourceInfo={sourceInfo}
          signOnly={signOnly}
          accountId={accountId}
          networkId={networkId}
          onSuccess={onSuccess}
          onFail={onFail}
          onCancel={onCancel}
          transferPayload={transferPayload}
        />
      </>
    ),
    [
      sendFeeStatus.errMessage,
      sendAlertStatus.isInsufficientNativeBalance,
      preCheckTxStatus.errorMessage,
      intl,
      network?.symbol,
      sourceInfo,
      accountId,
      networkId,
      transferPayload,
      useFeeInTx,
      signOnly,
      onSuccess,
      onFail,
      onCancel,
    ],
  );

  const handleOnClose = (extra?: { flag?: string }) => {
    if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
      dappApprove.reject();
    }
  };

  return (
    <Page scrollEnabled onClose={handleOnClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.transaction__transaction_confirm,
        })}
      />
      {renderSendConfirmView()}
    </Page>
  );
}

const SendConfirmContainerWithProvider = memo(
  withSendConfirmProvider(SendConfirmContainer),
);

export { SendConfirmContainer, SendConfirmContainerWithProvider };
