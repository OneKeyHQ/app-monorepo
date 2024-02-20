import BigNumber from 'bignumber.js';

import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
} from '@onekeyhq/shared/types/tx';

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

export function isSendNativeToken(action: IDecodedTxAction) {
  return (
    action.type === EDecodedTxActionType.ASSET_TRANSFER &&
    action.assetTransfer?.sends.every((send) => send.isNative)
  );
}
