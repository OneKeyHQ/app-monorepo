import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import {
  EModalRoutes,
  EModalSendRoutes,
  type IModalSendParamList,
} from '@onekeyhq/shared/src/routes';

export function useLidoMaticStake({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const navigation = useAppNavigation();
  return useCallback(
    async ({
      amount,
      onSuccess,
      onFail,
    }: {
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
    [navigation, accountId, networkId],
  );
}

export function useLidoMaticWithdraw({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { navigationToSendConfirm } = useSendConfirm({ accountId, networkId });
  return useCallback(
    async ({
      amount,
      onSuccess,
      onFail,
    }: {
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
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: accountAddress },
        onSuccess,
        onFail,
      });
    },
    [accountId, networkId, navigationToSendConfirm],
  );
}

export function useLidoMaticClaim({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { navigationToSendConfirm } = useSendConfirm({ accountId, networkId });
  return useCallback(
    async ({
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
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: accountAddress },
        onSuccess,
        onFail,
      });
    },
    [navigationToSendConfirm, accountId, networkId],
  );
}
