import { useCallback } from 'react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IDeFiActionTxConfirmDialogResult,
  showDeFiActionTxConfirmDialog,
} from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EEarnLabels, type IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

export type IBorrowSettleResult = {
  status: IDeFiActionTxConfirmDialogResult;
  data: ISendTxOnSuccessData[];
};

export type IBorrowBuildTxParams = {
  amount: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  collateralReserveAddress?: string;
  withdrawAll?: boolean;
  repayAll?: boolean;
  needsSetupLut?: boolean;
  slippageBps?: number;
  routeKey?: string;
  stakingInfo?: IStakingInfo;
  onSetupLutReadyForRepay?: () => void;
  onBeforeNavigate?: () => void | Promise<void>;
  onSettleResult?: (
    result: IBorrowSettleResult,
  ) => boolean | void | Promise<boolean | void>;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
  onCancel?: IModalSendParamList['SendConfirm']['onCancel'];
};

export function parseBorrowEncodedTx(tx: string): IEncodedTx {
  try {
    const parsed = JSON.parse(tx) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as IEncodedTx;
    }
  } catch {
    // Ignore parsing errors and fallback to raw string.
  }
  return tx;
}

export const attachBorrowOrderId = ({
  stakingInfo,
  orderId,
}: {
  stakingInfo?: IStakingInfo;
  orderId?: string;
}): IStakingInfo | undefined =>
  stakingInfo ? { ...stakingInfo, orderId } : undefined;

const getLatestTxId = (data: ISendTxOnSuccessData[]) => {
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const item = data[index];
    const txId = item?.signedTx?.txid || item?.decodedTx?.txid;
    if (txId) {
      return txId;
    }
  }

  return undefined;
};

const getEarnOrderTrackingInfo = (stakingInfo?: IStakingInfo) => ({
  stakingLabel: stakingInfo?.label,
  stakingProtocol: stakingInfo?.protocol,
  stakingTags: stakingInfo?.tags,
});

export const handleBorrowSuccess = async ({
  data,
  orderId,
  networkId,
  accountId,
  stakingInfo,
  onSettleResult,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  orderId?: string;
  networkId: string;
  accountId?: string;
  stakingInfo?: IStakingInfo;
  onSettleResult?: (
    result: IBorrowSettleResult,
  ) => boolean | void | Promise<boolean | void>;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  const latestTxId =
    Array.isArray(data) && data.length > 0 ? getLatestTxId(data) : undefined;

  const label = stakingInfo?.label;
  const shouldShowConfirmSheet =
    !!accountId &&
    (label === EEarnLabels.Withdraw || label === EEarnLabels.Repay);

  if (orderId && latestTxId) {
    const addEarnOrderPromise = backgroundApiProxy.serviceStaking.addEarnOrder({
      orderId,
      networkId,
      txId: latestTxId,
      status: data[data.length - 1]?.decodedTx.status,
      ...getEarnOrderTrackingInfo(stakingInfo),
    });
    if (shouldShowConfirmSheet) {
      void addEarnOrderPromise.catch(() => undefined);
    } else {
      await addEarnOrderPromise;
    }
  }

  if (shouldShowConfirmSheet && accountId) {
    const finalStatus = await showDeFiActionTxConfirmDialog({
      accountId,
      networkId,
      data,
    });
    if (onSettleResult) {
      const shouldContinueSuccess = await onSettleResult({
        status: finalStatus,
        data,
      });
      if (shouldContinueSuccess === false) {
        return;
      }
    }
    if (finalStatus === EOnChainHistoryTxStatus.Failed) {
      return;
    }
  }
  onSuccess?.(data);
};

export function useUniversalBorrowWithdraw({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      withdrawAll,
      stakingInfo,
      onBeforeNavigate,
      onSettleResult,
      onSuccess,
      onFail,
      onCancel,
    }: IBorrowBuildTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildWithdrawTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          amount,
          withdrawAll,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await onBeforeNavigate?.();

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            accountId,
            stakingInfo: stakingInfoWithOrderId,
            onSettleResult,
            onSuccess,
          });
        },
        onFail,
        onCancel,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalBorrowRepay({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      repayAll,
      stakingInfo,
      onBeforeNavigate,
      onSettleResult,
      onSuccess,
      onFail,
      onCancel,
    }: IBorrowBuildTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildRepayTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          amount,
          repayAll,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await onBeforeNavigate?.();

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            accountId,
            stakingInfo: stakingInfoWithOrderId,
            onSettleResult,
            onSuccess,
          });
        },
        onFail,
        onCancel,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}
