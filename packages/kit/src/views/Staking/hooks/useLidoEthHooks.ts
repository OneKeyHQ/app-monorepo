import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

export function useLidoStake({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
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
        await backgroundApiProxy.serviceStaking.buildLidoEthStakingTransaction({
          amount,
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

export function useLidoWithdraw({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
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

      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: accountAddress },
        onSuccess,
        onFail,
      });
    },
    [accountId, networkId, navigationToSendConfirm],
  );
}

export function useLidoClaim({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToSendConfirm } = useSendConfirm({ accountId, networkId });
  return useCallback(
    async ({
      requestIds,
      onSuccess,
      onFail,
    }: {
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
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: accountAddress },
        onSuccess,
        onFail,
      });
    },
    [navigationToSendConfirm, accountId, networkId],
  );
}
