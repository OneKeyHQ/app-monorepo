import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalRoutes,
  EModalSendRoutes,
  type IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

export function useLidoStake() {
  const navigation = useAppNavigation();
  return useCallback(
    async ({
      accountId,
      networkId,
      amount,
      onSuccess,
      onFail,
    }: {
      accountId: string;
      networkId: string;
      amount: string;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoEthStakingTransaction({
          amount,
        });
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendConfirm,
        params: {
          accountId,
          networkId,
          unsignedTxs: [{ encodedTx: { ...serverTx, from: accountAddress } }],
          onSuccess,
          onFail,
        },
      });
    },
    [navigation],
  );
}

export function useLidoWithdraw() {
  const navigation = useAppNavigation();
  return useCallback(
    async ({
      accountId,
      networkId,
      amount,
      onSuccess,
      onFail,
    }: {
      accountId: string;
      networkId: string;
      amount: string;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      const { message, deadline } =
        await backgroundApiProxy.serviceStaking.buildLidoEthPermitMessage({
          accountId,
          networkId,
          amount,
        });

      const signHash =
        (await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId,
          networkId,
          request: { origin: 'https://www.onekey.so', scope: 'ethereum' },
          unsignedMessage: {
            type: EMessageTypesEth.TYPED_DATA_V4,
            message,
          },
        })) as string;

      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoEthWithdrawalTransaction(
          {
            amount,
            signature: signHash,
            networkId,
            accountId,
            deadline,
          },
        );
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendConfirm,
        params: {
          accountId,
          networkId,
          unsignedTxs: [{ encodedTx: { ...serverTx, from: accountAddress } }],
          onSuccess,
          onFail,
        },
      });
    },
    [navigation],
  );
}

export function useLidoClaim() {
  const navigation = useAppNavigation();
  return useCallback(
    async ({
      accountId,
      networkId,
      requestIds,
      onSuccess,
      onFail,
    }: {
      accountId: string;
      networkId: string;
      requestIds: number[];
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoEthClaimTransaction({
          requestIds,
        });
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendConfirm,
        params: {
          accountId,
          networkId,
          unsignedTxs: [{ encodedTx: { ...serverTx, from: accountAddress } }],
          onSuccess,
          onFail,
        },
      });
    },
    [navigation],
  );
}
