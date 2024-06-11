import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

export function useLidoMaticStake({
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
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoMaticStakingTransaction(
          {
            amount,
            networkId,
          },
        );
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

      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoMaticWithdrawalTransaction(
          {
            amount,
            networkId,
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
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      tokenId: number;
      stakingInfo: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const serverTx =
        await backgroundApiProxy.serviceStaking.buildLidoMaticClaimTransaction({
          tokenId,
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
