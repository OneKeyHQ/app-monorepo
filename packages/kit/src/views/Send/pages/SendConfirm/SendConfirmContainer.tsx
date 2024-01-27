<<<<<<< HEAD
import { memo, useCallback, useEffect, useMemo } from 'react';
=======
import { memo, useCallback } from 'react';
>>>>>>> x

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, YStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
<<<<<<< HEAD
  useNativeTokenTransferAmount,
  useSendAlertStatus,
  useSendConfirmActions,
  useSendFeeStatus,
=======
>>>>>>> x
  useSendSelectedFeeInfoAtom,
  withSendConfirmProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

<<<<<<< HEAD
=======
import { SendActions } from '../../components/SendActions';
>>>>>>> x
import { EModalSendRoutes } from '../../router';

import { TxActionsContainer } from './TxActionsContainer';
import { TxFeeContainer } from './TxFeeContainer';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendConfirmContainer() {
  const intl = useIntl();
  const media = useMedia();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendConfirm>>();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const { accountId, networkId, unsignedTxs } = route.params;

  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
<<<<<<< HEAD
  const [nativeTokenTransferAmount] = useNativeTokenTransferAmount();
  const [sendFeeStatus] = useSendFeeStatus();
  const [sendAlertStatus] = useSendAlertStatus();

  const { updateSendAlertStatus } = useSendConfirmActions().current;

  const tableLayout = useMemo(() => media.gtLg, [media.gtLg]);

  const { result: nativeToken, isLoading: isLoadingNativeToken } =
    usePromiseResult(async () => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      if (!account) return;

      const tokenDetails =
        await backgroundApiProxy.serviceToken.fetchTokenDetails({
          networkId,
          accountAddress: account.address,
          address: '',
          isNative: true,
        });

      return tokenDetails;
    }, [accountId, networkId]);

  const handleOnConfirm = useCallback(async () => {
    const newUnsignedTxs = [];
    for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
      const unsignedTx = unsignedTxs[i];
      const newUnsignedTx =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          accountId,
          networkId,
          unsignedTx,
          feeInfo: sendSelectedFeeInfo?.feeInfo,
        });

=======

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

>>>>>>> x
      newUnsignedTxs.push(newUnsignedTx);
    }

    navigation.push(EModalSendRoutes.SendProgress, {
      networkId,
      accountId,
      unsignedTxs: newUnsignedTxs,
    });
  }, [accountId, navigation, networkId, sendSelectedFeeInfo, unsignedTxs]);
<<<<<<< HEAD

  useEffect(() => {
    console.log('nativeTokenTransferAmount', nativeTokenTransferAmount);
    console.log(
      'sendSelectedFeeInfo?.totalNative',
      sendSelectedFeeInfo?.totalNative,
    );
    console.log('nativeToken?.balanceParsed', nativeToken?.balanceParsed);

    if (
      new BigNumber(nativeTokenTransferAmount ?? 0)
        .plus(sendSelectedFeeInfo?.totalNative ?? 0)
        .gt(nativeToken?.balanceParsed ?? 0)
    ) {
      updateSendAlertStatus({ isInsufficientNativeBalance: true });
    } else {
      updateSendAlertStatus({ isInsufficientNativeBalance: false });
    }
  }, [
    nativeToken,
    nativeTokenTransferAmount,
    sendSelectedFeeInfo?.totalNative,
    updateSendAlertStatus,
  ]);

  const isSubmitDisabled = useMemo(() => {
    if (isLoadingNativeToken) return true;

    if (sendAlertStatus.isInsufficientNativeBalance) return true;

    if (sendFeeStatus.status !== ESendFeeStatus.Success) return true;
  }, [
    isLoadingNativeToken,
    sendAlertStatus.isInsufficientNativeBalance,
    sendFeeStatus.status,
  ]);
=======
>>>>>>> x

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      />
      <Page.Body>
<<<<<<< HEAD
        <YStack space="$4" px="$5">
=======
        <YStack space="$5" px="$5">
>>>>>>> x
          <TxActionsContainer
            accountId={accountId}
            networkId={networkId}
            unsignedTxs={unsignedTxs}
          />
<<<<<<< HEAD
=======
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Stack padding="$5">
>>>>>>> x
          <TxFeeContainer
            accountId={accountId}
            networkId={networkId}
            unsignedTxs={unsignedTxs}
          />
        </YStack>
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          size: tableLayout ? 'medium' : 'large',
          flex: tableLayout ? 0 : 2,
          disabled: isSubmitDisabled,
        }}
        cancelButtonProps={{
          size: tableLayout ? 'medium' : 'large',
          flex: tableLayout ? 0 : 1,
        }}
        onConfirmText="Sign and Broadcast"
        onConfirm={handleOnConfirm}
        onCancel={() => navigation.popStack()}
      />
    </Page>
  );
}

const SendConfirmContainerWithProvider = memo(
  withSendConfirmProvider(SendConfirmContainer),
);

export { SendConfirmContainer, SendConfirmContainerWithProvider };
