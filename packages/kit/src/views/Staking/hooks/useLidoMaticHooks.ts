import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalRoutes,
  EModalSendRoutes,
  type IModalSendParamList,
} from '@onekeyhq/shared/src/routes';

export function useLidoMaticStake() {
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
      const serverTxs =
        await backgroundApiProxy.serviceStaking.buildLidoMaticStakingTransaction(
          {
            amount,
            accountAddress,
          },
        );
      const unsignedTxs = serverTxs.map((tx) => ({
        encodedTx: { ...tx, from: accountAddress },
      }));
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendConfirm,
        params: {
          accountId,
          networkId,
          unsignedTxs,
          onSuccess,
          onFail,
        },
      });
    },
    [navigation],
  );
}

export function useLidoMaticWithdraw() {
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
        await backgroundApiProxy.serviceStaking.buildLidoMaticWithdrawalTransaction(
          {
            amount,
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

export function useLidoMaticClaim() {
  const navigation = useAppNavigation();
  return useCallback(
    async ({
      accountId,
      networkId,
      tokenId,
      onSuccess,
      onFail,
    }: {
      accountId: string;
      networkId: string;
      tokenId: number;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoMaticClaimTransaction({
          tokenId,
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
