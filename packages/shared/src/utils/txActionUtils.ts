import BigNumber from 'bignumber.js';

import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
} from '@onekeyhq/shared/types/tx';

import { EEarnLabels, type IStakingInfo } from '../../types/staking';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

import type { ISwapTxInfo } from '../../types/swap/types';

export function buildTxActionDirection({
  from,
  to,
  accountAddress,
}: {
  from?: string;
  to: string;
  accountAddress: string;
}) {
  const fixedFrom = from?.toLowerCase() ?? '';
  const fixedTo = to.toLowerCase();
  const fixedAccountAddress = accountAddress.toLowerCase();

  // out first for internal send
  if (fixedFrom && fixedFrom === fixedAccountAddress) {
    return EDecodedTxDirection.OUT;
  }
  if (fixedTo && fixedTo === fixedAccountAddress) {
    return EDecodedTxDirection.IN;
  }
  return EDecodedTxDirection.OTHER;
}

export function getDisplayedActions({ decodedTx }: { decodedTx: IDecodedTx }) {
  const { outputActions, actions } = decodedTx;
  return (
    (outputActions && outputActions.length ? outputActions : actions) || []
  );
}

export function mergeAssetTransferActions(actions: IDecodedTxAction[]) {
  const otherActions: IDecodedTxAction[] = [];
  let mergedAssetTransferAction: IDecodedTxAction | null = null;
  actions.forEach((action) => {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      if (mergedAssetTransferAction) {
        if (
          mergedAssetTransferAction.assetTransfer?.from ===
            action.assetTransfer.from &&
          mergedAssetTransferAction.assetTransfer.to === action.assetTransfer.to
        ) {
          mergedAssetTransferAction.assetTransfer.sends = [
            ...mergedAssetTransferAction.assetTransfer.sends,
            ...action.assetTransfer.sends,
          ];

          mergedAssetTransferAction.assetTransfer.receives = [
            ...mergedAssetTransferAction.assetTransfer.receives,
            ...action.assetTransfer.receives,
          ];

          mergedAssetTransferAction.assetTransfer.nativeAmount = new BigNumber(
            mergedAssetTransferAction.assetTransfer.nativeAmount ?? 0,
          )
            .plus(action.assetTransfer.nativeAmount ?? 0)
            .toFixed();

          mergedAssetTransferAction.assetTransfer.nativeAmountValue =
            new BigNumber(
              mergedAssetTransferAction.assetTransfer.nativeAmountValue ?? 0,
            )
              .plus(action.assetTransfer.nativeAmountValue ?? 0)
              .toFixed();
        } else {
          otherActions.push(action);
        }
      } else {
        mergedAssetTransferAction = action;
      }
    } else {
      otherActions.push(action);
    }
  });
  return [mergedAssetTransferAction, ...otherActions].filter(Boolean);
}

export function calculateNativeAmountInActions(actions: IDecodedTxAction[]) {
  let nativeAmount = '0';
  let nativeAmountValue = '0';

  actions.forEach((item) => {
    if (item.type === EDecodedTxActionType.ASSET_TRANSFER) {
      nativeAmount = new BigNumber(nativeAmount)
        .plus(item.assetTransfer?.nativeAmount ?? 0)
        .toFixed();
      nativeAmountValue = new BigNumber(nativeAmountValue)
        .plus(item.assetTransfer?.nativeAmountValue ?? 0)
        .toFixed();
    }
  });

  return {
    nativeAmount,
    nativeAmountValue,
  };
}

export function isSendNativeTokenAction(action: IDecodedTxAction) {
  return (
    action.type === EDecodedTxActionType.ASSET_TRANSFER &&
    action.assetTransfer?.sends.every((send) => send.isNative)
  );
}

export function getTxnType({
  actions,
  swapInfo,
  stakingInfo,
}: {
  actions: IDecodedTxAction[];
  swapInfo?: ISwapTxInfo;
  stakingInfo?: IStakingInfo;
}) {
  if (
    swapInfo ||
    actions.some((action) => action.type === EDecodedTxActionType.INTERNAL_SWAP)
  ) {
    return 'swap';
  }

  if (
    stakingInfo ||
    actions.some(
      (action) => action.type === EDecodedTxActionType.INTERNAL_STAKE,
    )
  ) {
    return 'stake';
  }

  if (
    actions.some((action) => action.type === EDecodedTxActionType.TOKEN_APPROVE)
  ) {
    return 'approve';
  }

  if (
    actions.some(
      (action) => action.type === EDecodedTxActionType.ASSET_TRANSFER,
    )
  ) {
    return 'send';
  }

  if (
    actions.some((action) => action.type === EDecodedTxActionType.FUNCTION_CALL)
  ) {
    return 'function call';
  }

  return 'unknown';
}

export function getStakingActionLabel({
  stakingInfo,
}: {
  stakingInfo: IStakingInfo;
}) {
  switch (stakingInfo.label) {
    case EEarnLabels.Claim:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_claim,
      });
    case EEarnLabels.Stake:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_stake,
      });
    case EEarnLabels.Redeem:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_redeem,
      });
    case EEarnLabels.Withdraw:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_withdraw,
      });
    default:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_unknown,
      });
  }
}
