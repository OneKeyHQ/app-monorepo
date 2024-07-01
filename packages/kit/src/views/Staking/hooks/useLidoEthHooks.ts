import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

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
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      amount: string;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoEthStakingTransaction({
          amount,
          networkId,
        });

      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: account.address },
        stakingInfo,
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
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      amount: string;
      stakingInfo: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
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
            payload: [account.address, message],
          },
          sceneName: EAccountSelectorSceneName.home,
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
        encodedTx: { ...serverTx, from: account.address },
        stakingInfo,
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
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      requestIds: number[];
      stakingInfo: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoEthClaimTransaction({
          requestIds,
          networkId,
        });
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: account.address },
        stakingInfo,
        onSuccess,
        onFail,
      });
    },
    [navigationToSendConfirm, accountId, networkId],
  );
}
