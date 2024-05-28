import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';

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
      onSuccess,
      onFail,
    }: {
      amount: string;
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
          },
        );
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: account.address },
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
      onSuccess,
      onFail,
    }: {
      amount: string;
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
          },
        );
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: account.address },
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
      tokenId: number;
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
        });
      await navigationToSendConfirm({
        encodedTx: { ...serverTx, from: account.address },
        onSuccess,
        onFail,
      });
    },
    [navigationToSendConfirm, accountId, networkId],
  );
}
