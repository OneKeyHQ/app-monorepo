import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

export function useUniversalStake({
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
      provider,
      symbol,
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      amount: string;
      symbol: string;
      provider: string;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const encodedTx =
        await backgroundApiProxy.serviceStaking.buildStakeTransaction({
          amount,
          networkId,
          accountId,
          symbol,
          provider,
        });

      await navigationToSendConfirm({
        encodedTx,
        stakingInfo,
        onSuccess,
        onFail,
      });
    },
    [navigationToSendConfirm, accountId, networkId],
  );
}

export function useUniversalWithdraw({
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
      symbol,
      provider,
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      amount: string;
      symbol: string;
      provider: string;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const encodedTx =
        await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
          amount,
          networkId,
          accountId,
          symbol,
          provider,
        });

      await navigationToSendConfirm({
        encodedTx,
        stakingInfo,
        onSuccess,
        onFail,
      });
    },
    [accountId, networkId, navigationToSendConfirm],
  );
}
