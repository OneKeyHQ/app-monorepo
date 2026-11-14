import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IDeFiActionTxConfirmDialogResult,
  showDeFiActionTxConfirmDialog,
} from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EEarnLabels, type IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

export type IBorrowSettleResult = {
  status: IDeFiActionTxConfirmDialogResult;
  data: ISendTxOnSuccessData[];
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
  expectedAccountAddress,
  stakingInfo,
  waitForFinalStatus,
  ignoreOrderTrackingError,
  onSettleResult,
  onSuccess,
  canNotify,
}: {
  data: ISendTxOnSuccessData[];
  orderId?: string;
  networkId: string;
  accountId?: string;
  expectedAccountAddress?: string;
  stakingInfo?: IStakingInfo;
  waitForFinalStatus?: boolean;
  ignoreOrderTrackingError?: boolean;
  onSettleResult?: (
    result: IBorrowSettleResult,
  ) => boolean | void | Promise<boolean | void>;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  canNotify?: () => Promise<boolean>;
}) => {
  const latestTxId =
    Array.isArray(data) && data.length > 0 ? getLatestTxId(data) : undefined;
  const label = stakingInfo?.label;
  const shouldShowConfirmSheet =
    !!accountId &&
    (waitForFinalStatus ||
      label === EEarnLabels.Withdraw ||
      label === EEarnLabels.Repay);
  if (orderId && latestTxId) {
    const addEarnOrderPromise = backgroundApiProxy.serviceStaking.addEarnOrder({
      orderId,
      networkId,
      txId: latestTxId,
      status: data[data.length - 1]?.decodedTx.status,
      ...getEarnOrderTrackingInfo(stakingInfo),
    });
    if (shouldShowConfirmSheet || ignoreOrderTrackingError) {
      void addEarnOrderPromise.catch(() => undefined);
    } else {
      await addEarnOrderPromise;
    }
  }
  if (shouldShowConfirmSheet && accountId) {
    const finalStatus = await showDeFiActionTxConfirmDialog({
      accountId,
      networkId,
      ...(expectedAccountAddress !== undefined
        ? { expectedAccountAddress }
        : undefined),
      data,
    });
    if (canNotify && !(await canNotify())) return;
    if (onSettleResult) {
      const shouldContinueSuccess = await onSettleResult({
        status: finalStatus,
        data,
      });
      if (shouldContinueSuccess === false) return;
    }
    if (
      finalStatus === EOnChainHistoryTxStatus.Failed ||
      (waitForFinalStatus && finalStatus !== EOnChainHistoryTxStatus.Success)
    )
      return;
  }
  if (canNotify && !(await canNotify())) return;
  onSuccess?.(data);
};
